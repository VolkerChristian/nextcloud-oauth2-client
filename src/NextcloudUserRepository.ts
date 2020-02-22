import { EntityRepository, Repository } from 'typeorm';
import { NextcloudUser } from './entity/NextcloudUser';
import { NextcloudToken } from './entity/NextcloudToken';

@EntityRepository(NextcloudUser)
export class NextcloudUserRepository extends Repository<NextcloudUser> {
    getUser(userName: string) {
        return new Promise<NextcloudUser>((resolve, reject) => {
            this.createQueryBuilder()
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

    getAllUser() {
        return new Promise<NextcloudUser[]>((resolve, reject) => {
            this.createQueryBuilder()
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
}
