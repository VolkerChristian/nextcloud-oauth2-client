import 'reflect-metadata';

import { Router } from 'express';
import { NextcloudUser } from './entity/NextcloudUser';
import { NextcloudToken } from './entity/NextcloudToken';
export { NextcloudUser } from './entity/NextcloudUser';
export { NextcloudToken } from './entity/NextcloudToken';
import cookieParser from 'cookie-parser';
import nextcloudConfig from './ncconfig.json';
import { oauth2Link, oauth2Unlink, oauth2Redirect } from './OAuth2';
import { createConnection, Connection } from 'typeorm';
import { NextcloudUserRepository } from './NextcloudUserRepository';


export const router = Router();

router.use(cookieParser());

router.get(nextcloudConfig.path.link, oauth2Link);
router.get(nextcloudConfig.path.unlink, oauth2Unlink);
router.get(nextcloudConfig.path.redirect, oauth2Redirect);

var _connection: Connection;

export async function connect() {
    _connection = await createConnection({
        type: "mysql",
        host: "proliant.home.vchrist.at",
        port: 3306,
        username: "wastereminder",
        password: "!!!SoMaSi01!!!",
        database: "WasteReminder",
        synchronize: true,
        logging: false,
        entities: [
            NextcloudUser,
            NextcloudToken
        ]
    });
}

export async function close() {
    if (connected()) {
        await _connection.close();
    }
}

export function connected() {
    return typeof _connection !== 'undefined';
}

export function getNextcloudUserRepository(): NextcloudUserRepository {
    return _connection.getCustomRepository(NextcloudUserRepository);
}
