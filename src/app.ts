import express from 'express';
import request from 'request';
import ICAL from 'ical.js';

import { router, getNextcloudUserRepository, getEntities, setConnection } from './';
import { createConnection } from 'typeorm';

const app = express();

app.use('/', router);

export async function connect() {
    let connection = await createConnection({
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

    return connection;
}


connect().then((connection) => {
    setConnection(connection);
    try {
        app.listen(8080, async err => {
            if (!err) {
                console.log('Server listening on 8080');
                
                const user = await getNextcloudUserRepository().getAllUser();
                console.log('User: ' + JSON.stringify(user, null, 4));


                app.get('/test', async (req, res) => {
                    console.log('PC: Looking for registered user');

                    let user = await getNextcloudUserRepository().getAllUser();

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
});