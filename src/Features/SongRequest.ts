
import { ILogger, LogManager } from "psst-log";
import { IContext, IMessage, ISpotifyConfig, Seconds } from "../shared";
import { FeatureBase } from "./FeatureBase";
import { Playlist, IPlaylist, SpotifyAuth, SpotifyApiWrapper, IAccessToken, ISongInfo } from "./SongRequestLib";

export interface ISongRequest {
    /** Invoke first to initialize the connection to spotify api */
    connect(): void;
}

export interface IApiWrapper {
    updateApiToken(token: string): void;
    getSong(request: string, msg: IMessage): Promise<ISongInfo>;
    requestCurrentSongInfo(msg: IMessage): void;

    getRemainingTrackTime(): Promise<Seconds>;
    isPausedOrStopped(): Promise<boolean>;
    playNow(uri: string): void;
}

export interface ICanReply {
    reply(text: string): void;
}


/** Enqueue songs to a playlist */
export class SongRequest extends FeatureBase implements ISongRequest, ICanReply {

    private readonly spotifyConfig: ISpotifyConfig;
    private readonly logger: ILogger;
    private readonly api: IApiWrapper;
    private readonly playlist: IPlaylist;

    private spotifyAuth: SpotifyAuth | undefined;
    private token: IAccessToken | undefined;

    constructor(context: IContext, apiWrapper?: IApiWrapper, playlist?: IPlaylist, logger?: ILogger) {
        super(context.getConfiguration());

        this.logger = logger ? logger : LogManager.getLogger();
        this.api = apiWrapper ? apiWrapper : new SpotifyApiWrapper(this);
        this.playlist = playlist ? playlist : new Playlist(this.api);

        this.spotifyConfig = {
            authProtocol: "",
            authHost: "",
            authPort: 0,
            tokenExpiresInHours: 0,
            secretKey: "",
            clientId: "",
            scopes: [],
        };

        let songRequestConfig = this.config.getSongRequest();
        if (songRequestConfig != null) {
            this.spotifyConfig = songRequestConfig.spotify;

            const fs = context.getFileSystem();
            const configDir = this.config.getConfigDir();
            const pathToTokenFile = fs.joinPaths(configDir, "spotifyToken.dat");
            this.spotifyAuth = new SpotifyAuth(this.spotifyConfig, pathToTokenFile, fs);
        }
    }

    public reply(text: string): void {
        const r = this.createResponse(text);
        this.sendResponse(r);
    }

    public connect(): void {
        if (!this.isSpotifyConnected() && this.spotifyAuth) {
            this.spotifyAuth.authenticate(() => {
                this.token = this.spotifyAuth?.getAccessToken();
                this.updateApiToken();
                this.playlist.start();
            });
        } else {
            if (!this.spotifyAuth) {
                this.logger.error("Spotify authentication is not possible. Please file a problem report.");
            } else if (this.isSpotifyConnected()) {
                this.logger.warn("Spotify is already connected");
            } else {
                this.logger.warn("Spotify is not configured correctly");
            }
        }
    }

    private isSpotifyConnected(): boolean {
        return this.isSpotifyEnabled() && this.token != undefined;
    }

    private isSpotifyEnabled(): boolean {
        return this.spotifyConfig.authPort > 0
            && this.spotifyConfig.authHost != ""
            && this.spotifyConfig.authProtocol != ""
            && this.spotifyConfig.tokenExpiresInHours > 0
            && this.spotifyConfig.clientId != ""
            && this.spotifyConfig.scopes.length > 0
            && this.spotifyConfig.secretKey != "";
    }

    /** Enqueue the requested song to the playlist */
    public act(msg: IMessage): void {
        if (this.token == "") {
            return;
        }
        const splits = msg.text.split(" ");
        const cmd = splits[0].toLowerCase();
        const request = splits.slice(1).join(" ");

        if (!this.spotifyAuth) {
            return;
        }

        this.updateApiToken();

        const commandMap = new Map<string, () => void>();
        commandMap.set("!sr", () => this.requestSong(request, msg));
        commandMap.set("!songrequest", () => this.requestSong(request, msg));
        commandMap.set("!song", () => this.requestCurrentSong());
        commandMap.set("!skip", () => this.skipCurrentSong(msg));
        commandMap.set("!rs", () => this.removeMyLastRequest(msg.from));
        commandMap.set("!sr-start", () => this.playlist.start());
        commandMap.set("!sr-stop", () => this.playlist.stop());

        const executor = commandMap.get(cmd);
        if (executor) {
            executor.call(this);
        }
    }

    private updateApiToken() {
        const token = this.token?.toString() || "";
        if (this.token == "") {
            return;
        }

        this.api.updateApiToken(token);
    }

    private requestSong(request: string, msg: IMessage) {
        this.api.getSong(request, msg)
            .then((song: ISongInfo) => {
                if (this.playlist.isInQueue(song)) {
                    this.reply(`Sorry @${song.requestedBy}, the song is already in the queue.`);
                }

                if (this.playlist.enqueue(song)) {
                    this.reply(`SingsNote @${song.requestedBy} added '${song.title}' (from ${song.artist}) to the playlist SingsNote`);
                } else {
                    this.reply(`Sorry @${song.requestedBy}, you can not add more songs to the playlist.`);
                }
            })
            .catch((err) => {
                this.logger.error("SongRequest.requestSong: Could not get song.", JSON.stringify(err), JSON.stringify(msg));
                this.reply(`Sorry @${msg.from}, I could not find your song.`);
            });
    }

    private requestCurrentSong() {
        const song = this.playlist.getCurrent();
        if (song) {
            this.reply(`SingsNote Current song: '${song.title}' from ${song.artist}`);
        }
    }

    private skipCurrentSong(msg: IMessage) {
        if (this.playlist.getCurrent()?.requestedBy.toLowerCase() == msg.from.toLowerCase()) {
            this.playlist.skip();
            return;
        }

        const canSkip = msg.tags?.isMod() || msg.tags?.isBroadcaster();
        if (canSkip) {
            this.playlist.skip();
        }
    }

    private removeMyLastRequest(user: string) {
        const removedSong = this.playlist.removeLastSongFromUser(user);
        if (removedSong) {
            this.reply(`@${user}, I removed '${removedSong.title}' from the playlist.`);
        }
    }
}

export default SongRequest;