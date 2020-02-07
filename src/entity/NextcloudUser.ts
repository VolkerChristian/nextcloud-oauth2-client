require('reflect-metadata');
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    UpdateDateColumn,
    CreateDateColumn,
    VersionColumn,
    OneToOne,
    getConnection
} from 'typeorm';
import {
    NextcloudToken
} from './NextcloudToken';
import ClientOAuth2, { RequestObject } from 'client-oauth2';
import uuid from 'uuid';
import {
    Request,
    Response,
    CookieOptions
} from 'express';
import * as nextcloudConfig from '../../ncconfig.json';

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

@Entity()
export class NextcloudUser {
    constructor(userName: string) {
        this.userName = userName;
        this.token = new NextcloudToken();
    }

    updateToken(tokenData: ClientOAuth2.Data) {
        this.token.accessToken = tokenData.access_token;
        this.token.refreshToken = tokenData.refresh_token;
        this.token.expiresIn = tokenData.expires_in;
        this.token.tokenType = tokenData.token_type;
    }

    @PrimaryGeneratedColumn()
    id: number;

    @Column('varchar', { length: 63 })
    @Index('userName', { unique: true })
    userName: string;

    @UpdateDateColumn()
    changed: Date;

    @CreateDateColumn()
    created: Date;

    @VersionColumn()
    version: Number;

    @OneToOne(type => NextcloudToken, token => token.user, {
        cascade: ['insert', 'update']
    })
    token: NextcloudToken;


    private static nextcloudAuth: ClientOAuth2 = new ClientOAuth2(nextcloudConfig.oauth2Config);


    static getUser(userName: string) {
        return new Promise<NextcloudUser>((resolve, reject) => {
            getConnection('nextcloud').getRepository<NextcloudUser>('NextcloudUser')
                .createQueryBuilder('user')
                .leftJoinAndMapOne(
                    'user.token',
                    NextcloudToken,
                    'token',
                    'token.userId = user.id'
                )
                .where(
                    'user.userName = :userName', { userName: userName }
                )
                .getOne()
                .then((user) => {
                    resolve(user)
                })
                .catch((reason) => reject(reason))
        });
    }


    static getAllUser() {
        return new Promise<NextcloudUser[]>((resolve, reject) => {
            getConnection('nextcloud').getRepository<NextcloudUser>('NextcloudUser')
                .createQueryBuilder('user')
                .leftJoinAndMapOne(
                    'user.token',
                    NextcloudToken,
                    'token',
                    'token.userId = user.id'
                )
                .getMany()
                .then((user) => resolve(user))
                .catch((reason) => reject(reason))
        });
    }


    private getToken(): Promise<ClientOAuth2.Token> {
        return new Promise((resolve, reject) => {
            const token = NextcloudUser.nextcloudAuth.createToken({
                access_token: this.token.accessToken,
                refresh_token: this.token.refreshToken,
                token_type: this.token.tokenType,
                expires_in: this.token.expiresIn
            });
            if (token.expired()) {
                token.refresh()
                    .then(token => {
                        this.updateToken(token.data);
                        getConnection('nextcloud').createEntityManager().save(this)
                            .then(() => resolve(token))
                            .catch(reason => reject(reason));
                    })
                    .catch(reason => reject(reason));
            } else {
                resolve(token);
            }
        });
    }


    sign<T extends RequestObject>(req: T) {
        return new Promise<T>((resolve, reject) => {
            this.getToken()
                .then(token => {
                    token.sign(req);
                    resolve(req);
                })
                .catch(reason => reject(reason));
        });
    };


    private static linkRequestHandler(req: Request, res: Response, user: NextcloudUser, token: ClientOAuth2.Token) {
        if (!user) {
            user = new NextcloudUser(token.data.user_id);
        }
        user.updateToken(token.data);

        getConnection('nextcloud').getRepository(NextcloudUser).save(user)
            .then(() => {
                console.log('User "' + token.data.user_id + '" linked');
                res.status(201).send('User "' + token.data.user_id + '" linked');
            })
            .catch(reason => {
                console.error(reason + ': Processing User: ' + token.data.user_id);
                res.status(500).send(reason + ': Processing User: ' + token.data.user_id);
            });
    }


    private static unlinkRequestHandler(_req: Request, res: Response, user: NextcloudUser, token: ClientOAuth2.Token) {
        if (user) {
            getConnection('nextcloud').getRepository(NextcloudUser).remove(user)
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


    private static cookieStore: CookieStore = {};

    static oauth2AuthRedirect(_req: Request, res: Response, handler: Handler) {
        const cookie = uuid();
        res.cookie('auth', cookie, nextcloudConfig.cookieOptions);

        const timeout = setTimeout(cookie => {
            console.log('Cookie ' + cookie + ' expired.');
            delete NextcloudUser.cookieStore[cookie];
        }, 600 * 1000, cookie);

        NextcloudUser.cookieStore[cookie] = {
            state: uuid(),
            timeout: timeout,
            handler: handler
        };

        console.log('Response auth-cookie: ' + JSON.stringify(cookie, null, 4));
        console.log('Response state of auth-cookie: ' + JSON.stringify(NextcloudUser.cookieStore[cookie].state, null, 4));

        res.redirect(NextcloudUser.nextcloudAuth.code.getUri({ state: NextcloudUser.cookieStore[cookie].state }));
    }


    static oauth2Link(req: Request, res: Response) {
        NextcloudUser.oauth2AuthRedirect(req, res, NextcloudUser.linkRequestHandler);
    }


    static oauth2Unlink(req: Request, res: Response) {
        NextcloudUser.oauth2AuthRedirect(req, res, NextcloudUser.unlinkRequestHandler);
    }


    static oauth2Redirect(req: Request, res: Response) {
        if (req.cookies.auth && NextcloudUser.cookieStore[req.cookies.auth]) {
            res.clearCookie('auth', nextcloudConfig.cookieOptions);

            const cookieData = NextcloudUser.cookieStore[req.cookies.auth];
            delete NextcloudUser.cookieStore[req.cookies.auth];

            const state = cookieData.state;
            clearTimeout(cookieData.timeout);

            NextcloudUser.nextcloudAuth.code.getToken(req.originalUrl, { state: state })
                .then(token => {
                    NextcloudUser.getUser(token.data.user_id)
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
}
