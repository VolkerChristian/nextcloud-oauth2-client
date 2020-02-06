require('reflect-metadata');
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    BaseEntity,
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
import { inspect } from 'util';
import cookieParser from 'cookie-parser';

interface CookieStore {
    [key: string]: {
        state: string,
        timeout: NodeJS.Timer
    }
};

@Entity()
export class NextcloudUser extends BaseEntity {
    constructor(userName: string) {
        super();
        this.userName = userName;
        this.token = new NextcloudToken();
    }

    @PrimaryGeneratedColumn()
    private id: number;

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

    private static nextcloudAuth: ClientOAuth2 = new ClientOAuth2(nextcloudConfig.appConfig);

    static prepare(app: import('express-serve-static-core').Express) {
        app.use(cookieParser());
    }


    static getUser(userName: string) {
        return new Promise<NextcloudUser>((resolve, reject) => {
            getConnection().getRepository<NextcloudUser>('NextcloudUser')
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
                    if (!user) {
                        user = new NextcloudUser(userName);
                    }
                    resolve(user)
                })
                .catch((reason) => reject(reason))
        });
    }

    static getAllUser() {
        return new Promise<NextcloudUser[]>((resolve, reject) => {
            getConnection().getRepository<NextcloudUser>('NextcloudUser')
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
                        this.token.accessToken = token.data.access_token;
                        this.token.refreshToken = token.data.refresh_token;
                        this.token.expiresIn = token.data.expires_in;
                        this.token.tokenType = token.data.token_type;
                        this.save()
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


    private static cookieStore: CookieStore = {};

    static authCallback(req: Request, res: Response) {
        const cookie = uuid();
        const cookieOptions: CookieOptions = nextcloudConfig.cookieOptions;

        res.cookie('grant', cookie, cookieOptions);

        const timeout = setTimeout(cookie => {
            console.log('Cookie ' + cookie + ' expired.');
            delete NextcloudUser.cookieStore[cookie];
        }, 600 * 1000, cookie);

        NextcloudUser.cookieStore[cookie] = {
            state: uuid(),
            timeout: timeout
        };

        console.log('Response grant-cookie: ' + JSON.stringify(cookie, null, 4));
        console.log('Response state of grant-cookie: ' + JSON.stringify(NextcloudUser.cookieStore[cookie].state, null, 4));

        res.redirect(NextcloudUser.nextcloudAuth.code.getUri({ state: NextcloudUser.cookieStore[cookie].state }));
    }


    static authGrantCallback(req: Request, res: Response) {
        if (req.cookies.grant && NextcloudUser.cookieStore[req.cookies.grant]) {
            const state = NextcloudUser.cookieStore[req.cookies.grant].state;

            console.log('Request cookie: ' + JSON.stringify(req.cookies, null, 4));
            console.log('Request state of grant-cookie: ' + JSON.stringify(state));

            clearTimeout(NextcloudUser.cookieStore[req.cookies.grant].timeout);
            delete NextcloudUser.cookieStore[req.cookies.grant];

            const cookieOptions: CookieOptions = nextcloudConfig.cookieOptions;
            cookieOptions.expires = new Date(1);
            res.clearCookie('grant', cookieOptions);

            NextcloudUser.nextcloudAuth.code.getToken(req.originalUrl, { state: state })
                .then(async token => {
                    console.log('Token: ' + inspect(token));
                    try {
                        const user = await NextcloudUser.getUser(token.data.user_id);
                        user.token.accessToken = token.data.access_token;
                        user.token.refreshToken = token.data.refresh_token;
                        user.token.expiresIn = token.data.expires_in;
                        user.token.tokenType = token.data.token_type;
                        await user.save();
                        res.status(201).send('User "' + token.data.user_id + '" provisioned');
                    } catch (reason) {
                        res.status(500).send(reason + ': Provisioning User: ' + token.data.user_id);
                    }
                })
                .catch(reason => {
                    console.error('Auth error: Not authorized');
                    res.status(401).send('Auth error: Not authorized');
                });
        } else {
            console.error('Auth error: No "grant" cookie found');
            res.status(400).send('Auth error: No valid cookie found')
        }
    }
}
