import { EntityRepository, Repository } from 'typeorm';
import { NextcloudUser } from './entity/NextcloudUser';
import { NextcloudToken } from './entity/NextcloudToken';

@EntityRepository(NextcloudUser)
export class NextcloudUserRepository extends Repository<NextcloudUser> {
    getUser(userName: string) {
        return this.createQueryBuilder('user')
            .leftJoinAndMapOne(
                'user.token',
                NextcloudToken,
                'token',
                'token.userId = user.id'
            )
            .where(
                'user.userName = :userName', { userName: userName }
            )
            .getOne();
    }

    
    getAllUser() {
        return this.createQueryBuilder('user')
            .leftJoinAndMapOne(
                'user.token',
                NextcloudToken,
                'token',
                'token.userId = user.id'
            )
            .getMany();
    }
}
