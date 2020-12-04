import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    UpdateDateColumn,
    CreateDateColumn,
    VersionColumn,
    OneToOne,
    getRepository
} from 'typeorm';
import {
    NextcloudToken
} from './NextcloudToken';
import ClientOAuth2, { RequestObject } from 'client-oauth2';


let nextcloudAuth: ClientOAuth2; // = new ClientOAuth2(nextcloudConfig.oauth2Config);

export function getNextcloudAuth(): ClientOAuth2 {
    return nextcloudAuth;
}

export function setNextcloudAuth(oAuth2Config: ClientOAuth2.Options) {
    nextcloudAuth = new ClientOAuth2(oAuth2Config);
}


@Entity()
export class NextcloudUser {
    constructor(userName: string) {
        this.userName = userName;
    }

    updateToken(tokenData: ClientOAuth2.Data) {
        if (!this.token) {
            this.token = new NextcloudToken();
        }
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


    getToken(): Promise<ClientOAuth2.Token> {
        return new Promise((resolve, reject) => {
            if (this.token) {
                const token = nextcloudAuth.createToken({
                    access_token: this.token.accessToken,
                    refresh_token: this.token.refreshToken,
                    token_type: this.token.tokenType,
                    expires_in: this.token.expiresIn
                });
                if (token.expired()) {
                    token.refresh()
                        .then(token => {
                            this.updateToken(token.data);
                            getRepository<NextcloudUser>('NextcloudUser').save(this)
                                .then(() => resolve(token))
                                .catch(reason => reject(reason));
                        })
                        .catch(reason => reject(reason));
                } else {
                    resolve(token);
                }
            } else {
                reject("ERROR: Application-User not linked to Nextcloud");
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
}
