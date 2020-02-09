import 'reflect-metadata';
import express, { Router } from 'express';
import request from 'request';
import ICAL from 'ical.js';

import { ncStartUp, NextcloudUser } from './index';


ncStartUp().then((router: Router) => {
    const app = express();
    app.use('/', router);
    try {
        app.listen(8080, async err => {
            if (!err) {
                console.log('Server listening on 8080');

                const user = await NextcloudUser.getAllUser();
                console.log('User: ' + JSON.stringify(user, null, 4));


                app.get('/test', async (req, res) => {
                    console.log('PC: Looking for registered user');

                    let user = await NextcloudUser.getAllUser();

                    user.forEach(async user => {
                        console.log('Processing user "' + user.userName + '"');
                        var rec = await user.sign({
                            url: 'https://cloud.vchrist.at/remote.php/dav/calendars/'
                                + user.userName
                                + '/mllabfuhr/?export'
                                + '&expand=1'
                                + '&start=' + ((Date.now() / 1000) | 0)
                                + '&end=' + ((Date.now() / 1000 + 3600 * 24) | 0),
                            headers: {
                                Accept: 'application/calendar+json'
                            }
                        });

                        request(rec, (error, response, body) => {
                            if (!error) {
                                let str = '';
                                let iCalData = JSON.parse(body);
                                let comp = new ICAL.Component(iCalData);
                                let vevent = comp.getFirstSubcomponent('vevent');
                                let event = new ICAL.Event(vevent);

                                if (event.startDate) {
                                    str = 'Event Summary: ' + event.summary + '\nLocale Start: ' + event.startDate.toJSDate() + '\nLocale End: ' + event.endDate.toJSDate();
                                } else {
                                    str = 'No Event';
                                }

                                res.status(200).send(str + '\n');
                                console.log(str);
                            } else {
                                res.status(response.statusCode).send(response.statusMessage);
                            }
                        });
                    });
                });
            } else {
                console.error('Server Error: ' + err);
            }
        });
    } catch (reason) {
        console.error('Server Error: ' + reason);
    }
}).catch(reason => console.error(reason));
