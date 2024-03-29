import { ILogger, LogManager } from "psst-log";

import { IAlert, IEmailAccess, IObsController, AlertAction, IMediaPlayer, Sound, IContext } from "../shared";
import { IMessage } from "../shared/ChatClient";
import { FeatureBase } from "./FeatureBase";

class AlertConst {
    /** Placeholder in config pattern entries */
    public static readonly ViewerPlaceholder = "{Viewer}";
    /** Default encoding for file actions */
    public static readonly Encoding = "utf8";
}

class PendingAlert {
    public readonly viewer: string;
    public readonly action: Function;

    constructor(viewer: string, action: Function) {
        this.viewer = viewer;
        this.action = action;
    }
}

/** Perform actions (alerts) on events like "New Follower", "New Sub" ... */
export class Alerts extends FeatureBase {
    private readonly logger: ILogger;
    private readonly mediaPlayer: IMediaPlayer;
    private readonly obs: IObsController;
    private readonly alertConfig: IAlert;
    private readonly pendingAlerts: PendingAlert[] = [];
    private readonly maxActions: number = 20; // TODO get from config
    private readonly email: IEmailAccess;
    private readonly regex = /(.*) folgt dir jetzt auf Twitch$/g; // TODO configurable regex
    // TODO action file horizontal or vertical
    // TODO action file separator for horizontal
    // TODO action file prefix

    private timer: NodeJS.Timer | null = null;

    constructor(context: IContext, logger?: ILogger) {
        super(context.getConfiguration());
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        this.mediaPlayer = context.getMediaPlayer();

        this.obs = context.getObs();
        this.alertConfig = this.config.getAlerts()[0]; // todo handle all alerts

        this.email = context.getEmail();
        this.email.onNewMail({
            subjectRegex: /(.*) folgt dir jetzt auf Twitch$/g,
            callback: (mail) => { this.unreadMail(mail.subject); }
        });
    }

    /** just check whether an alert was triggered manually */
    public act(msg: IMessage): void {
        if (this.isBotHost(msg) && this.isAlertCommand(msg)) {
            this.handleUserToBotCommand(msg);
            return;
        }

        // I think bots will not get the notification of being hosted via a whisper?
        if (msg.from.toLowerCase() == "jtv") {
            this.handleTwitchCommands(msg);
        }
    }
    
    private isAlertCommand(msg: IMessage) {
        return msg.text.toLowerCase().startsWith("!alert");
    }

    private isBotHost(msg: IMessage) {
        return msg.from.toLowerCase() == this.config.getNickname().toLowerCase();
    }

    private handleTwitchCommands(msg: IMessage): void {
        // radiodefiant is now hosting you.
        const regex = /(\w+) is now hosting you\./;
        let match = regex.exec(msg.text);
        if (match != null && match.length > 0) {
            this.performNewHostActions(match[1]);
        }
    }
    private performNewHostActions(hostFrom: string) {

        let newFollowerAlert = new PendingAlert(hostFrom, () => {
            this.sendHostThanksToChat(hostFrom);
            this.mediaPlayer.play(Sound.Bell);
            //this.setObsNewHostText(hostFrom);
            this.appendToViewerActionsHistory(hostFrom, "Host");
            //this.obs.toggleSource(this.alertConfig.parameter, this.alertConfig.durationInSeconds);
        });

        this.notifyNewAlert(newFollowerAlert);
    }

    private sendHostThanksToChat(hostFrom: string) {
        // let text = this.alertConfig.chatPattern.replace(AlertConst.ViewerPlaceholder, hostFrom);
        let text = "Danke für Deinen Host {Viewer}!".replace(AlertConst.ViewerPlaceholder, hostFrom);
        let response = this.createResponse(text);
        this.sendResponse(response);
    }

    private handleUserToBotCommand(msg: IMessage): void {
        let parts = msg.text.split(" ");
        if (parts.length >= 2 && parts[0].toLowerCase() == "!alert" && parts[1].toLowerCase() == "follower") {
            this.performNewFollowerActions(parts[2]);
        }
    }

    private performNewFollowerActions(newFollower: string) {

        let newFollowerAlert = new PendingAlert(newFollower, () => {
            this.sendFollowerThanksToChat(newFollower);
            this.setObsNewFollowerText(newFollower);
            this.appendToViewerActionsHistory(newFollower, null);
            this.obs.toggleSource(this.alertConfig.parameter, this.alertConfig.durationInSeconds);
        });

        this.notifyNewAlert(newFollowerAlert);
    }

    private notifyNewAlert(newAlert: PendingAlert) {
        this.pendingAlerts.push(newAlert);

        if (this.timer == null) {
            this.timer = setInterval(() => {
                let alert = this.pendingAlerts.shift();
                if (alert == undefined) {
                    if (this.timer != null) {
                        let t = this.timer;
                        this.timer = null;
                        clearInterval(t);
                    }
                } else {
                    alert.action();
                }
            }, (this.alertConfig.durationInSeconds + this.alertConfig.timeoutInSeconds) * 1000 + 1000); //1s if all is 0 is minimum
        }
    }

    private setObsNewFollowerText(newFollower: string) {
        let text = this.alertConfig.sceneTextPattern.replace(AlertConst.ViewerPlaceholder, newFollower);
        this.obs.setText(this.alertConfig.sceneTextSource, text);
    }

    private sendFollowerThanksToChat(newFollower: string) {
        let text = this.alertConfig.chatPattern.replace(AlertConst.ViewerPlaceholder, newFollower);
        let response = this.createResponse(text);
        this.sendResponse(response);
    }

    /** Writes a name to a text file
     * @param viewerName The name of the stream viewer
     * @param action Pass an action to be displayed next to the viewer name or null to leave it out 
     */
    private appendToViewerActionsHistory(viewerName: string, action: string | null): void {
        const separator = "  ";
        const endSeparator = "---";

        let name = this.alertConfig.bannerTextPattern.replace(AlertConst.ViewerPlaceholder, viewerName);
        let bannerText = name + separator;
        bannerText += endSeparator + separator;
        this.obs.setText(this.alertConfig.bannerTextSource, bannerText);
    }

    private unreadMail(subject: string) {
        let result = this.regex.exec(subject);
        if (result != null && result.length > 1) {
            this.performNewFollowerActions(result[1]);
        }
    }
}

export default Alerts;