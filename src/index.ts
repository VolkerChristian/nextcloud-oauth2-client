import 'reflect-metadata';

import { Router } from 'express';
import { NextcloudUser, setNextcloudAuth } from './entity/NextcloudUser';
import { NextcloudToken } from './entity/NextcloudToken';
import cookieParser from 'cookie-parser';
import { oauth2Link, oauth2Unlink, oauth2Redirect, setCookieOptions } from './OAuth2';
import { createConnection, Connection } from 'typeorm';
import { NextcloudUserRepository } from './NextcloudUserRepository';
import ClientOAuth2 from 'client-oauth2';

export { NextcloudUser } from './entity/NextcloudUser';
export { NextcloudToken } from './entity/NextcloudToken';

export const router: Router = Router();

router.use(cookieParser());

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
        entities: getEntities()
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

export function setNextcloudConfig(nextcloudConfig ) {
    setNextcloudAuth(nextcloudConfig.oauth2Config);
    setCookieOptions(nextcloudConfig.cookieOptions);

    router.get(nextcloudConfig.path.link, oauth2Link);
    router.get(nextcloudConfig.path.unlink, oauth2Unlink);
    router.get(nextcloudConfig.path.redirect, oauth2Redirect);
}

export function getNextcloudUserRepository(): NextcloudUserRepository {
    return _connection.getCustomRepository(NextcloudUserRepository);
}

export function getEntities() {
    return [NextcloudUser, NextcloudToken];
}

export function setConnection(connection: Connection) {
    _connection = connection;
}