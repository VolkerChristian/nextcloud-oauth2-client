import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
    CreateDateColumn,
    VersionColumn,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { NextcloudUser } from './NextcloudUser';

@Entity()
export class NextcloudToken {
    @PrimaryGeneratedColumn()
    id: number;

    @Column('varchar', { length: 1024 })
    accessToken: string;

    @Column('varchar', { length: 1024 })
    refreshToken: string;

    @Column('varchar', { length: 63 })
    tokenType: string;

    @Column('datetime')
    private expires: Date;

    @UpdateDateColumn()
    changed: Date;

    @CreateDateColumn()
    created: Date;

    @VersionColumn()
    version: Number;

    @OneToOne(type => NextcloudUser, user => user.token, {
        onDelete: 'CASCADE'
    })
    @JoinColumn()
    user: NextcloudUser;


    set expiresIn(expiresIn: string) {
        this.expires = new Date((Date.now() / 1000 + +expiresIn) * 1000);
    }

    get expiresIn(): string {
        return (((this.expires.valueOf() - Date.now()) / 1000 - 300)|0).toString();
    }
}
