import "reflect-metadata";
import { createConnection } from "typeorm";
import { NextcloudUser } from "./entity/NextcloudUser";
import express from 'express';
import request from 'request';
import ICAL from 'ical.js';

createConnection().then(async connection => {
    const app = express();
    NextcloudUser.prepare(app);

    app.get("/auth/nextcloud", NextcloudUser.authCallback);
    app.get("/auth/nextcloud/grant", NextcloudUser.authGrantCallback);

    app.listen(8080, err => {
        if (!err) {
            console.log("Server listening on 8080");
        } else {
            console.error("Server Error: " + err);
        }
    });

    const user = await NextcloudUser.getAllUser();
    console.log("User: " + JSON.stringify(user, null, 4));


    app.get('/test', async (req, res) => {
        console.log('PC: Looking for registered user');

        let user = await NextcloudUser.getAllUser();

        user.forEach(async user => {
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

                    res.status(200).send(str + "\n");
                    console.log(str);
                } else {
                    res.status(response.statusCode).send(response.statusMessage);
                }
            });
        });
    });
});
