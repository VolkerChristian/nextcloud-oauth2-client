import 'reflect-metadata';
import { createConnection } from 'typeorm';
import { Router } from 'express';
import { NextcloudUser } from './entity/NextcloudUser';
import cookieParser from 'cookie-parser';
import * as nextcloudConfig from '../ncconfig.json';


const startUp = new Promise<Router>((resolve, reject) => {
    createConnection('nextcloud')
        .then(async connection => {
            const router = Router();
            router.use(cookieParser());

            router.get(nextcloudConfig.path.link, NextcloudUser.oauth2Link);
            router.get(nextcloudConfig.path.unlink, NextcloudUser.oauth2Unlink);
            router.get(nextcloudConfig.path.redirect, NextcloudUser.oauth2Redirect);

            resolve(router);
        })
        .catch(reason => reject(reason));
});


export {
    startUp,
    NextcloudUser
}