import 'reflect-metadata';
import { Router } from 'express';
import { NextcloudUser } from './entity/NextcloudUser';
import cookieParser from 'cookie-parser';
import nextcloudConfig from '../ncconfig.json';
import { oauth2Link, oauth2Unlink, oauth2Redirect } from './OAuth2';


const router = Router();

router.use(cookieParser());

router.get(nextcloudConfig.path.link, oauth2Link);
router.get(nextcloudConfig.path.unlink, oauth2Unlink);
router.get(nextcloudConfig.path.redirect, oauth2Redirect);


export {
    router,
    NextcloudUser
}
