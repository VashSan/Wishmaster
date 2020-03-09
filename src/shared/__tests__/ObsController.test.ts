import * as OBSWebSocket from 'obs-websocket-js';
import { ObsController } from '../ObsController';
import { mock, MockProxy } from 'jest-mock-extended';
import { ILogger } from 'psst-log';
import { IObsConfig } from '../Configuration';
import { Seconds } from '../Helper';

const TestSceneName = 'testScene';

function mockSendInit(obs: MockProxy<OBSWebSocket> & OBSWebSocket) {
    return obs.send.mockResolvedValueOnce({
        messageId: "1",
        status: "ok",
        "current-scene": "current-scene",
        scenes: [{
            name: TestSceneName,
            sources: []
        }]
    });
}

function createMock(): MockProxy<OBSWebSocket> & OBSWebSocket {
    let obs = mock<OBSWebSocket>();
    obs.connect.mockResolvedValueOnce();
    return obs;
}

test('construction', async () => {
    let logger = mock<ILogger>();
    let obs = mock<OBSWebSocket>();
    let config = mock<IObsConfig>();
    expect(() => new ObsController(config, obs, logger)).not.toThrow();
});

test('connect fails', async () => {
    let logger = mock<ILogger>();
    let config = mock<IObsConfig>();
    let obs = createMock();
    obs.connect.mockReset();
    obs.connect.mockRejectedValueOnce("err");

    let obsController = new ObsController(config, obs, logger);

    await expect(obsController.connect()).rejects.toContain("err");
});

test('switchToScene', async (done) => {
    let logger = mock<ILogger>();
    let config = mock<IObsConfig>();
    let obs = createMock();
    mockSendInit(obs).mockResolvedValueOnce();

    let obsController = new ObsController(config, obs, logger);

    await obsController.connect();

    obsController.switchToScene(TestSceneName);

    setTimeout((err) => {
        expect(logger.warn).toBeCalledTimes(0);
        expect(logger.info).toBeCalledTimes(2);
        expect(err).toBeUndefined();

        expect(obs.send).toHaveBeenCalledTimes(2);
        expect(obs.send).toHaveBeenCalledWith("SetCurrentScene", expect.any(Object));
        done();
    }, new Seconds(0.1).inMilliseconds());
});

test('setText', () => {
    let logger = mock<ILogger>();
    let config = mock<IObsConfig>();
    let obs = createMock();
    let obsController = new ObsController(config, obs, logger);
    //There is bug that the "render" property is not recognized
    obs.send.mockResolvedValueOnce();
    // {
    //     render: true,
    //     source: "string",      
    //     "bk-color": 1,
    //     "bk-opacity": 1,
    //     chatlog: true,
    //     chatlog_lines: 1,
    //     color: 1,
    //     extents: true,
    //     extents_cx: 1,
    //     extents_cy: 1,
    //     file: "string",
    //     read_from_file: true,
    //     font: {style: "string", size: 1, face: "string", flags: 1},
    //     vertical: true,
    //     align: "string",
    //     valign: "string",
    //     text: "string",
    //     gradient: true,
    //     gradient_color: 1,
    //     gradient_dir: 1,
    //     outline: true,
    //     outline_color: 1,
    //     outline_size: 1,
    //     outline_opacity: 1
    //   });
    obsController.setText(TestSceneName, "text");
    expect(obs.send).toBeCalledTimes(1);
    expect(obs.send).toHaveBeenCalledWith("SetTextGDIPlusProperties", expect.any(Object));
});

test('setVisible', () => {
    let logger = mock<ILogger>();
    let config = mock<IObsConfig>();
    let obs = createMock();
    let obsController = new ObsController(config, obs, logger);

    obs.send.mockResolvedValueOnce();

    obsController.setSourceVisible("source", true);

    expect(obs.send).toBeCalledWith("SetSceneItemProperties", expect.any(Object));
});

test('getVisible', async () => {
    const logger = mock<ILogger>();
    const config = mock<IObsConfig>();
    const obs = createMock();
    const obsController = new ObsController(config, obs, logger);

    obs.send.mockResolvedValueOnce({ visible: true } as any);

    const visibility = await obsController.isSourceVisible("source");

    expect(visibility).toBe(true);
    expect(obs.send).toBeCalledWith("GetSceneItemProperties", { item: "source" });
});

test('toggleSource', async (done) => {
    // Arrange
    const logger = mock<ILogger>();
    const config = mock<IObsConfig>();
    const obs = createMock();

    mockSendInit(obs);
    const obsController = new ObsController(config, obs, logger);
    await obsController.connect();

    obs.send.mockResolvedValue({ visible: true } as any);

    // Act
    obsController.toggleSource("source", 0.01);

    // Assert
    setTimeout(() => {
        expect(obs.send).toHaveBeenNthCalledWith(2, "GetSceneItemProperties", expect.any(Object));
        expect(obs.send).toHaveBeenNthCalledWith(3, "SetSceneItemProperties", expect.any(Object));
        expect(obs.send).toHaveBeenNthCalledWith(4, "GetSceneItemProperties", expect.any(Object));
        expect(obs.send).toHaveBeenNthCalledWith(5, "SetSceneItemProperties", expect.any(Object));
        done();
    }, new Seconds(0.1).inMilliseconds());

});