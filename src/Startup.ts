
import { LogManager, ILogger } from "psst-log";

import { MessageProcessor, IFeature } from "./MessageProcessor";
import { Configuration, Context, Database, UserCollection, ObsController, IConfiguration, IContext, Seconds, LogCollection } from "./shared";
import { Alerts } from "./Features/Alerts";
import { Bets } from "./Features/Bets";
import { Harvest } from "./Features/Harvest";
import { StaticAnswers } from "./Features/StaticAnswers";
import { Stomt } from "./Features/Stomt";
import { SongRequest } from "./Features/SongRequest";
import { UrlFilter } from "./Features/UrlFilter";



export class Startup {
    private config: IConfiguration;
    private logger: ILogger;
    private msgProcessor: MessageProcessor;
    private db: Database;
    private obsController: ObsController;
    private context: IContext;

    private loadedCollections = 0;
    private erroredCollections = 0;

    constructor(context?: IContext, config?: IConfiguration, logger?: ILogger) {
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
            LogManager.addConsoleTarget();
        }

        if (config) {
            this.config = config;
        } else {
            this.config = new Configuration();
        }

        this.db = new Database(this.config);
        this.obsController = new ObsController(this.config.getObs());

        if (context) {
            this.context = context;
        } else {
            this.context = new Context(this.config, this.logger, this.db, this.obsController);
        }

        this.msgProcessor = new MessageProcessor(this.context);
    }

    public main(): number {
        if (!this.config.getCreateLogConsole()) {
            LogManager.removeConsoleTarget();
        }

        if (this.config.getCreateLogFile()) {
            LogManager.addFileTarget(this.config.getLogDir(), this.config.getMaxLogAgeDays());
        }

        this.logger.info("Wishmaster at your serivce.");
        this.logger.info("https://github.com/VashSan/wishmaster");
        if (process.platform != "win32") {
            this.logger.warn("This program likely contains bugs in other OS than Windows. Please report bugs.");
        }

        this.logger.info("connecting to OBS");
        this.obsController.connect();

        this.logger.info("setting up db");
        this.setupDb()
            .then(() => this.finalInit())
            .catch(() => {
                this.logger.error("Database load failed");
            });

        return 0;
    }

    private setupDb(): Promise<void> {
        this.db.createCollection(UserCollection, "user");
        this.db.createCollection(LogCollection, "log");
        return this.db.waitAllLoaded(new Seconds(10));
    }

    private finalInit() {
        if (this.db.getSize() == this.loadedCollections) {
            this.logger.info("setting up chat");
            this.setupChat();

            this.logger.info("setting up console");
            this.setupConsole();
        }

        if (this.erroredCollections > 0 && this.db.getSize() == this.erroredCollections + this.loadedCollections) {
            this.logger.error("Can not work without all databases loaded. Terminating.");
            process.exitCode = 1;
        }
    }

    private setupChat() {

        let featureList = new Set<IFeature>([
            new Alerts(this.context),
            new Harvest(this.context),
            new StaticAnswers(this.context),
            new UrlFilter(this.context),
            // new Stomt(context),
            // new SongRequest(context),
            new Bets(this.context)
        ]);

        this.msgProcessor = new MessageProcessor(this.context);
        this.msgProcessor.connect();
        for (const f of featureList) {
            this.msgProcessor.registerFeature(f);
        }
    }

    private setupConsole() {
        var stdin = process.openStdin();
        stdin.addListener("data", this.consoleCallback.bind(this));
    }

    private consoleCallback(d: object) {
        // note:  d is an object, and when converted to a string it will
        // end with a linefeed.  so we (rather crudely) account for that  
        // with toString() and then trim() 
        // let val = d.toString().trim();

        // let that = this;

        // this.db.users.find({ name: val }, function (err: any, doc: any) {
        //     if (err != null) {
        //         that.logger.error(err);
        //     } else {
        //         that.logger.log(doc[0], doc[1]);
        //     }
        // });
    }
}


export default Startup;