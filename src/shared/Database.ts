import Nedb = require("nedb");
import { isNullOrUndefined } from "util";
import { IConfiguration } from "./Configuration";
import { ILogger, LogManager } from "psst-log";
import { Seconds } from "./Helper";

type CollectionMap = Map<string, ICollection>;

export interface ICollection {
    isInitialized(): boolean;
    getError(): any;
    getName(): string;
}

export interface IUserAction {
    name: string;
    lastAction: ViewerAction;
    lastActionDate: Date;
}

export interface IUserCollection extends ICollection {
    findLastActions(maxActions: number): Promise<IUserAction[]>;
    newFollowFrom(viewer: string): void;
    newHostFrom(viewer: string): void;

}

export interface ILogCollection extends ICollection {

}

export interface IDatabase {
    getSize(): number;
    createCollection<T extends ICollection>(type: { new(...args: any[]): T; }, name: string): T
    get(name: string): ICollection;
}

class Collection implements ICollection {
    protected readonly db: Nedb;
    protected readonly logger: ILogger;

    private readonly name: string;

    private initialized: boolean = false;
    private error: any = null;


    constructor(name: string, db: Nedb, logger?: ILogger) {
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }
        this.db = db;
        this.name = name;
        db.loadDatabase(this.loadDatabaseCallback.bind(this));
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public getName(): string {
        return this.name;
    }


    public getError(): any {
        return this.error;
    }

    private loadDatabaseCallback(err: any): void {
        if (err != null) {
            this.error = err;
        } else {
            this.initialized = true;
        }
    }
}

export class Database implements IDatabase {
    private readonly map: CollectionMap = new Map<string, ICollection>();
    private config: IConfiguration;
    private logger: ILogger;

    constructor(config: IConfiguration, logger?: ILogger) {
        this.config = config;
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }
    }

    public getSize(): number {
        return this.map.size;
    }

    public get<T extends ICollection>(name: string): T {
        let collection = this.map.get(name);
        if (isNullOrUndefined(collection)) {
            // we throw because we implemented that this could never happen
            throw `Collection '${collection}' is not initialized`;
        }
        return <T>collection;
    }

    public createCollection<T extends ICollection>(type: { new(...args: any[]): T; }, name: string): T {
        const configDir = this.config.getConfigDir();
        const channel = this.config.getChannel();
        const file = `${configDir}\\${name}-${channel}.db`

        const options =
        {
            filename: file,
            timestampData: true
        };

        let db = new Nedb(options);
        let collection = new type(name, db);

        this.map.set(name, collection);
        return collection;
    }

    public waitAllLoaded(timeoutInSeconds: Seconds): Promise<void> {
        return new Promise((resolve, reject) => {
            let done = false;
            let start = Date.now();

            let interval = setInterval(() => {
                done = true;
                this.map.forEach(element => {
                    done = done && element.isInitialized();
                    if (element.getError() != null) {
                        reject(`Database '${element.getName()}' failed to load: ${element.getError()}`);
                    }
                });

                let timedOut = Date.now() > start + timeoutInSeconds.inMilliseconds();

                if (timedOut || done) {
                    clearInterval(interval);
                    if (done) {
                        resolve();
                    } else {
                        reject("Timeout reached");
                    }
                }
            }, new Seconds(0.1).inMilliseconds());

        });
    }
}

export enum ViewerAction {
    Host = "Host",
    Follow = "Follow"
}
type NameAndActionArray = { name: string, lastAction: number, lastActionDate: Date }[];
export class UserCollection extends Collection implements IUserCollection {

    findLastActions(maxActions: number): Promise<IUserAction[]> {
        return new Promise((resolve, reject) => {
            this.db.find({}, { name: 1, lastAction: 1, lastActionDate: 1 })
                .sort({ lastActionDate: -1 })
                .limit(maxActions)
                .exec((err, docs) => {
                    if (err != null) {
                        reject(err);
                    } else {
                        let result = this.assembleResult(docs);
                        resolve(result);
                    }
                });
        });
    }
    private assembleResult(docs: { name: number, lastAction: number, lastActionDate: number }[]): IUserAction[] {
        let result: IUserAction[] = [];
        docs.forEach((element) => {
            let action = element.lastAction.toString() as keyof typeof ViewerAction;
            const userAction: IUserAction = {
                name: element.name.toString(),
                lastAction: ViewerAction[action],
                lastActionDate: new Date(element.lastActionDate.toString())
            };
            result.push(userAction);
        });
        return result;
    }


    newFollowFrom(viewer: string): void {
        const now = new Date();
        const nedbUpdate = {
            $inc: { hostCount: 1 },
            $set: { lastHostDate: now, lastAction: ViewerAction.Host.toString(), lastActionDate: now },
        };

        this.updateOrInsert({ name: viewer }, nedbUpdate);
    }

    newHostFrom(viewer: string): void {
        const now = new Date();
        const nedbUpdate = { $set: { followDate: now, lastAction: ViewerAction.Follow.toString(), lastActionDate: now } };
        this.updateOrInsert({ name: viewer }, nedbUpdate);
    }

    private updateOrInsert(query: any, updateQuery: any) {
        this.db.update(query, updateQuery, { upsert: true });
    }
};


export class LogCollection extends Collection implements ILogCollection { };