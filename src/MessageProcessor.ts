import { isNullOrUndefined } from "util";
import { ILogger } from "psst-log";
import { Configuration, Context } from "./shared";
import TwitchChatClient, { IChatClient, IMessage } from "./ChatClient";

export type ResponseCallback = (error: string | null, response: IFeatureResponse) => void;

export enum UserType {
    Normal,
    Moderator,
    GlobalMod,
    Admin,
    Staff
}

export interface IFeature {
    readonly trigger: string;
    setup(callback: ResponseCallback): void;
    act(message: IMessage): void;
}

export interface IFeatureResponse {
    message: IMessage;
}

export class Emote {
    id: number = 0;
    start: number = 0;
    end: number = 0;
}


export class Tags {
    private logger: ILogger;
    public color: string = "";
    public displayName: string = "";
    public isEmoteOnly: boolean = false;
    public emoteList: Set<Emote> = new Set<Emote>();
    public messageId: string = "";
    public isMod: boolean = false;
    public roomId: number = 0;
    public isSubscriber: boolean = false;
    public serverReceivedMsgTime: number = 0;
    public isTurbo: boolean = false;
    public userId: number = 0;
    public userType: UserType = UserType.Normal;
    public bits: number = 0;
    public badgeList: string[] = [];

    constructor(tags: string, logger: ILogger) {
        this.logger = logger;
        if (!tags.startsWith("@")) {
            logger.error("does not seem to be valid tag", tags);
            return;
        }
        this.parseTags(tags.substring(1));
    }

    private parseTags(tags: string) {
        let tagList: string[] = tags.split(";");

        for (const tag of tagList) {
            let tagTuple = tag.split("=");
            let tagName = tagTuple[0];
            let tagValue = tagTuple[1];

            this.assignTag(tagName, tagValue);
        }
    }

    private assignTag(name: string, value: string): void {
        switch (name.toLowerCase()) {
            case "color":
                this.color = value;
                break;
            case "bits":
                this.bits = this.parseInt(value);
            case "badges":
                this.badgeList = this.parseBadges(value);
                break;
            case "display-name":
                this.displayName = value;
                break;
            case "emote-only":
                this.isEmoteOnly = this.parseBool(value);
                break;
            case "emotes":
                this.parseEmotes(value);
                break;
            case "id":
                this.messageId = value;
                break;
            case "mod":
                this.isMod = this.parseBool(value);
                break;
            case "room-id":
                this.roomId = this.parseInt(value);
                break;
            case "subscriber":
                this.isSubscriber = this.parseBool(value);
                break;
            case "sent-ts":
                this.logger.log("Unknow tag sent-ts received");
                break;
            case "tmi-sent-ts":
                this.serverReceivedMsgTime = Number.parseInt(value);
                break;
            case "turbo":
                this.isTurbo = this.parseBool(value);
                break;
            case "user-id":
                this.userId = this.parseInt(value);
                break;
            case "user-type":
                this.userType = this.parseUserType(value);
                break;
            default:
                this.logger.error(`Unknown tag: '${name}' = '${value}'`);
        }
    }

    private parseUserType(t: string): UserType {
        switch (t.toLowerCase()) {
            case "":
                return UserType.Normal;
            case "mod":
                return UserType.Moderator;
            case "global_mod":
                return UserType.GlobalMod;
            case "admin":
                return UserType.Admin;
            case "staff":
                return UserType.Staff;
        }

        this.logger.error("Unknown UserType:", t);
        return UserType.Normal;
    }

    private parseBool(b: string): boolean {
        try {
            return b != "0";
        } catch (ex) {
            this.logger.error(ex);
            return false;
        }
    }

    private parseInt(i: string): number {
        try {
            return Number.parseFloat(i);
        } catch (ex) {
            this.logger.error(ex);
            return 0;
        }
    }

    private parseBadges(badgesString: string): string[] {
        let bList = badgesString.split(",");
        let result: string[] = [];

        for (const badge of bList) {
            let b = badge.split("/");

            if (b[0].length > 0) {
                result.push(b[0]);
            }
        }

        return result;
    }

    private parseEmotes(value: string) {
        if (value == "") {
            return;
        }
        // emoteDefintion[/emoteDefintion]...
        let emotes = value.split("/");

        for (const emoteString of emotes) {
            // emoteDefintion = emoteId:emotePositionList
            let separatorPos = emoteString.indexOf(":");
            let emoteName = emoteString.substring(0, separatorPos);
            let emoteId = this.parseInt(emoteName);
            let emotePositionString = emoteString.substring(separatorPos + 1);

            // emotePositionList = position[,position]
            let emotePositionList = emotePositionString.split(",");
            for (const position of emotePositionList) {
                // position = start-end
                let positionTuple = position.split("-");
                let start: number = this.parseInt(positionTuple[0]);
                let end: number = this.parseInt(positionTuple[1]);

                let emote = new Emote();
                emote.id = emoteId;
                emote.start = start;
                emote.end = end;

                this.emoteList.add(emote);
            }
        }
    }
}

export class Message {
    text: string = "";
    from: string = "";
    /** Channel starts with # otherwise it is a whisper or system notice I guess */
    channel: string = "";
    tags: Tags | null;

    constructor(init: Partial<Message>, tags?: Tags) {
        (<any>Object).assign(this, init);
        if (isNullOrUndefined(tags)) {
            this.tags = null;
        } else {
            this.tags = tags;
        }
    }

    toString(): string {
        let result: string = `Message from '${this.from}' to '${this.channel}': ${this.text}`;
        return result;
    }
}

export class MessageProcessor {
    private featureMap = new Map<string, Set<IFeature>>();
    private cClient: IChatClient;
    private context: Context;
    private config: Configuration;
    private logger: ILogger;
    private delayedMessages: IFeatureResponse[] = [];
    private messageCount30Sec = 0;
    private messageOfTheDay: string = "";

    constructor(context: Context, chatClient?: IChatClient) {
        this.context = context;
        this.config = context.config;
        this.logger = context.logger;

        if (chatClient) {
            this.cClient = chatClient;
        } else {
            this.cClient = new TwitchChatClient(this.config.server, this.config.nickname, this.config.password);
        }

        this.cClient.onMessage((msg: IMessage): void => {
            this.process(msg);
        });

        this.cClient.onError((error: string): void => {
            this.logger.error(error);
        });
    }

    public connect() {
        setInterval(this.resetMessageCount.bind(this), 1000 * 30);
        setInterval(this.processDelayedMessages.bind(this), 1000 * 10);

        this.cClient.connect(this.config.channel);
    }

    private resetMessageCount() {
        this.messageCount30Sec = 0;
    }

    private processDelayedMessages() {
        if (this.delayedMessages.length > this.config.msgLimitPer30Sec) {
            console.warn("There are too many responses queued! I will be busy for a while...");
        }

        let count = 0;
        while (this.delayedMessages.length > 0) {

            if (!this.isUnderMessageLimit()) {
                return;
            }

            let msg = this.delayedMessages.shift();
            if (msg != undefined) {
                this.processResponse(null, msg);
            }

            count += 1;
            if (count > this.config.msgLimitPer30Sec / 3) {
                // we check every 10 seconds, so we can split our responses in 3 batches.
                // TODO Think about having a response timeout, so unimportant stuff can be removed from the queue in a safe manner.
                return;
            }
        }
    }

    public registerFeature(plugin: IFeature) {
        plugin.setup(this.processResponse.bind(this));

        if (plugin.trigger == null) {
            this.logger.warn("A plugin without a trigger was registered: " + plugin.constructor.name);
            return;
        }

        let trigger = plugin.trigger.toLowerCase().trim();

        let featureList = this.featureMap.get(trigger);
        if (isNullOrUndefined(featureList)) {
            featureList = new Set<IFeature>();
            this.featureMap.set(trigger, featureList);
        }

        featureList.add(plugin);
    }

    public process(message: IMessage) {
        let alwaysTriggered = this.featureMap.get("");
        this.invokePlugins(message, alwaysTriggered);

        let trigger = this.getTrigger(message);
        if (trigger == null) {
            return;
        }

        let thisTimeTriggered = this.featureMap.get(trigger);
        this.invokePlugins(message, thisTimeTriggered);
    }

    private getTrigger(msg: IMessage): string | null {
        if (msg.text.length == 0) {
            return null;
        }

        if (!msg.text.startsWith("!")) {
            return null;
        }

        let spaceIndex = msg.text.indexOf(" ");
        if (spaceIndex == 1) {
            return null; // second char is " " ... thats not triggering stuff
        }
        if (spaceIndex == -1) {
            return msg.text.substring(1); // trigger is one word only
        }

        return msg.text.substring(1, spaceIndex).toLowerCase();
    }

    private invokePlugins(msg: IMessage, plugins: Set<IFeature> | undefined) {
        if (!isNullOrUndefined(plugins)) {
            for (let p of plugins) {
                p.act(msg);
            }
        }
    }

    private processResponse(err: string | null, r: IFeatureResponse) {
        if (err != null) {
            this.logger.error("processResponse Error", err);
        }

        if (r == null) {
            return;
        }

        if (!isNullOrUndefined(r.message) && r.message.text != "" && r.message.channel != "") {
            if (this.isUnderMessageLimit()) {
                this.messageCount30Sec += 1;
                this.cClient.send(r.message.channel, r.message.text);
            } else {
                this.deferResponse(r);
            }
        }
    }

    private isUnderMessageLimit(): boolean {
        return this.messageCount30Sec + 1 <= this.config.msgLimitPer30Sec;
    }

    private deferResponse(msg: IFeatureResponse) {
        for (const m of this.delayedMessages) {
            if (this.responseEquals(m, msg)) {
                return;
            }
        }

        this.delayedMessages.push(msg);
    }

    private responseEquals(m1: IFeatureResponse, m2: IFeatureResponse): boolean {
        if (m1 == m2) {
            return true;
        }

        let compares = [
            [m1.message.channel, m2.message.channel],
            [m1.message.from, m2.message.from],
            [m1.message.tags, m2.message.tags],
            [m1.message.text, m2.message.text]
        ];

        for (const comp of compares) {
            if (comp[0] != comp[1]) {
                return false;
            }
        }

        return true;
    }
}


