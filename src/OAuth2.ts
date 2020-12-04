
import { NextcloudUser, getNextcloudAuth } from './entity/NextcloudUser';
import ClientOAuth2 from 'client-oauth2';
import {
    Request,
    Response
} from 'express';
import uuid = require('uuid');
import { getNextcloudUserRepository } from './';

interface Handler {
    (req: Request, res: Response, user: NextcloudUser, token: ClientOAuth2.Token): void;
}

interface CookieData {
    state: string,
    timeout: NodeJS.Timer,
    handler: Handler
}

interface CookieStore {
    [key: string]: CookieData
};


function linkRequestHandler(req: Request, res: Response, user: NextcloudUser, token: ClientOAuth2.Token) {
    if (!user) {
        user = new NextcloudUser(token.data.user_id);
    }
    user.updateToken(token.data);

    getNextcloudUserRepository()
        .save(user)
        .then(() => {
            console.log('User "' + token.data.user_id + '" linked');
            res.status(201).send('User "' + token.data.user_id + '" linked');
        })
        .catch(reason => {
            console.error(reason + ': Processing User: ' + token.data.user_id);
            res.status(500).send(reason + ': Processing User: ' + token.data.user_id);
        });
}


function unlinkRequestHandler(req: Request, res: Response, user: NextcloudUser, token: ClientOAuth2.Token) {
    if (user) {
        getNextcloudUserRepository()
            .remove(user)
            .then(() => {
                console.log('User "' + token.data.user_id + '" unlinked');
                res.status(201).send('User "' + token.data.user_id + '" unlinked');
            })
            .catch(reason => {
                console.error(reason + ': Processing User: ' + token.data.user_id);
                res.status(500).send(reason + ': Processing User: ' + token.data.user_id);
            });
    } else {
        console.error('Can not unlink user "' + token.data.user_id + '" - not linked!');
        res.status(400).send('Can not unlink user "' + token.data.user_id + '" - not linked!')
    }
}


const cookieStore: CookieStore = {};

export function oauth2AuthRedirect(_req: Request, res: Response, handler: Handler) {
    const cookie = uuid();
    res.cookie('auth', cookie, _cookieOptions);

    const timeout = setTimeout(cookie => {
        console.log('Cookie ' + cookie + ' expired.');
        delete cookieStore[cookie];
    }, 600 * 1000, cookie);

    cookieStore[cookie] = {
        state: uuid(),
        timeout: timeout,
        handler: handler
    };

    console.log('Response auth-cookie: ' + JSON.stringify(cookie, null, 4));
    console.log('Response state of auth-cookie: ' + JSON.stringify(cookieStore[cookie].state, null, 4));
    console.log('CookieOptions: ' + JSON.stringify(_cookieOptions));

    res.redirect(getNextcloudAuth().code.getUri({ state: cookieStore[cookie].state }));
}


export function oauth2Link(req: Request, res: Response) {
    oauth2AuthRedirect(req, res, linkRequestHandler);
}


export function oauth2Unlink(req: Request, res: Response) {
    oauth2AuthRedirect(req, res, unlinkRequestHandler);
}


export function oauth2Redirect(req: Request, res: Response) {
    console.log("Cookie Auth: " + req.cookies.auth);
    if (req.cookies.auth && cookieStore[req.cookies.auth]) {
        res.clearCookie('auth', _cookieOptions);

        const cookieData = cookieStore[req.cookies.auth];
        delete cookieStore[req.cookies.auth];

        const state = cookieData.state;
        clearTimeout(cookieData.timeout);

        getNextcloudAuth().code.getToken(req.originalUrl, { state: state })
            .then(token => {
                getNextcloudUserRepository().getUser(token.data.user_id)
                    .then(user => {
                        cookieData.handler(req, res, user, token);
                    })
                    .catch(reason => {
                        console.error(reason);
                        res.status(500).send(reason);
                    });
            })
            .catch(reason => {
                console.error(reason);
                res.status(401).send(reason);
            });
    } else {
        console.error("Bad request - no cookie");
        res.status(400).send("Bad request");
    }
}

let _cookieOptions;

export function setCookieOptions(cookieOptions) {
    _cookieOptions = cookieOptions;
}