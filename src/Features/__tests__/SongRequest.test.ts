import { mock, MockProxy } from "jest-mock-extended";
import { IConfiguration, IContext, ISongRequestConfig, IFileSystem, IMessage, ITagReader, ISpotifyConfig } from "../../shared";
import { SongRequest, IApiWrapper } from "../SongRequest";
import { ILogger } from "psst-log";
import { IPlaylist, ISongInfo } from "../SongRequestLib/PlayList";
import { ISongListWriter } from "../SongRequestLib/SongListWriter";
import { IWebAuth, IAccessToken } from "../SongRequestLib";

let api: MockProxy<IApiWrapper> & IApiWrapper;
let apiAuth: MockProxy<IWebAuth> & IWebAuth;
let accessToken: MockProxy<IAccessToken> & IAccessToken;
let logger: MockProxy<ILogger> & ILogger;
let playlist: MockProxy<IPlaylist> & IPlaylist;
let context: MockProxy<IContext> & IContext;
let spotifyConfig: MockProxy<ISpotifyConfig> & ISpotifyConfig;
let songListWriter: MockProxy<ISongListWriter> & ISongListWriter;

const broadcasterTags = mock<ITagReader>();
broadcasterTags.isBroadcaster.mockReturnValue(true);

const modTags = mock<ITagReader>();
modTags.isMod.mockReturnValue(true);

function createSongRequest() {
    return new SongRequest(context, apiAuth, api, playlist, logger, songListWriter);
}

beforeEach(() => {
    api = mock<IApiWrapper>();
    accessToken = mock<IAccessToken>();

    apiAuth = mock<IWebAuth>();
    apiAuth.getAccessToken.mockReturnValue(accessToken);

    logger = mock<ILogger>();
    playlist = mock<IPlaylist>();
    spotifyConfig = mock<ISpotifyConfig>();
    songListWriter = mock<ISongListWriter>();

    let songConfig = mock<ISongRequestConfig>();
    songConfig.spotify = spotifyConfig;

    let config = mock<IConfiguration>();
    config.getSongRequest.mockReturnValue(songConfig);

    let fs = mock<IFileSystem>();

    context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);
    context.getFileSystem.mockReturnValue(fs);
});

test('construction', () => {
    expect(() => createSongRequest()).not.toThrow();
});

test('request song updates song list', (done) => {
    // Arrange
    const song = mock<ISongInfo>();
    song.requestedBy = "bob";

    api.getSong.mockResolvedValue(song);

    playlist.isInQueue.mockReturnValue(false);
    playlist.enqueue.mockReturnValue(true);

    const sr = createSongRequest();
    const msg: IMessage = { text: "!sr Innuendo Queen", from: "alice", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    setTimeout(() => {
        expect(playlist.enqueue).toBeCalled();
        expect(songListWriter.update).toBeCalled();
        done();
    }, 100);
});

test('skip song from user', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!skip", from: "bob", channel: "" };

    const song = mock<ISongInfo>();
    song.requestedBy = "bob";
    playlist.getCurrent.mockReturnValue(song);

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.skip).toBeCalled();
});

test('skip song by mod or broadcaster', () => {
    // Arrange
    const sr = createSongRequest();

    const msgFromMod: IMessage = { text: "!skip", from: "mod", channel: "", tags: modTags };

    const msgFromBroadcaster: IMessage = { text: "!skip", from: "broadcaster", channel: "", tags: broadcasterTags };

    const song = mock<ISongInfo>();
    song.requestedBy = "bob";
    playlist.getCurrent.mockReturnValue(song);

    // Act
    sr.act(msgFromMod);
    sr.act(msgFromBroadcaster);

    //Assert
    expect(playlist.skip).toBeCalledTimes(2);
});

test('skip song with no permission', () => {
    // Arrange
    const sr = createSongRequest();

    const tags = mock<ITagReader>();
    tags.isMod.mockReturnValue(false);
    tags.isBroadcaster.mockReturnValue(false);
    const msg: IMessage = { text: "!skip", from: "weirdGuy", channel: "", tags: tags };

    const song = mock<ISongInfo>();
    song.requestedBy = "bob";
    playlist.getCurrent.mockReturnValue(song);

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.skip).not.toBeCalled();
});

test('remove last song from user', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!rs", from: "bob", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.removeLastSongFromUser).toBeCalledWith("bob");
});

test('stop', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!sr-stop", from: "bob", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.stop).toBeCalled();
});

test('start', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!sr-start", from: "bob", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.start).toBeCalled();
});

test('volume', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "", tags: modTags };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).toBeCalledWith(50);
});

test('volume byUser', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).not.toBeCalled();
});


test('volume > max', () => {
    // Arrange
    spotifyConfig.maxVolumeByCommand = 45;
    const sr = createSongRequest();
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "", tags: modTags };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).toBeCalledWith(45);
});

test('volume < min', () => {
    // Arrange
    spotifyConfig.minVolumeByCommand = 55;
    const sr = createSongRequest();
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "", tags: modTags };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).toBeCalledWith(55);
});

test('request song list', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!songlist", from: "bob", channel: "" };

    let repliesReceived = 0;
    sr.setup(() => { repliesReceived += 1 });

    // Act
    sr.act(msg);
    sr.act(msg); // the second is timed out

    //Assert
    expect(repliesReceived).toBe(1);
});

test('add song', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!songlist", from: "bob", channel: "" };

    let repliesReceived = 0;
    sr.setup(() => { repliesReceived += 1 });

    // Act
    sr.act(msg);
    sr.act(msg); // the second is timed out

    // Assert
    expect(repliesReceived).toBe(1);
});

test('connect', (done) => {
    // Arrange
    spotifyConfig.device = "id";
    apiAuth.authenticate.mockImplementation((authCallback) => authCallback());
    api.getPlaybackDevices.mockResolvedValue([{ id: "id", name: "name" }]);
    const sr = createSongRequest();

    // Act
    sr.connect();

    // Assert
    setTimeout(() => {
        expect(api.updateApiToken).toBeCalledWith(expect.any(String));
        expect(api.setPlaybackDevice).toBeCalledWith({ id: "id", name: "name" });
        done();
    });
});