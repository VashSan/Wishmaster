import * as OBSWebSocket from 'obs-websocket-js';
import { ObsController } from '../ObsController';
import { mock, MockProxy } from 'jest-mock-extended';
import { ILogger } from 'psst-log';
import { IObsConfig } from '../Configuration';

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

test('switchToScene', async (done) => {
    let logger = mock<ILogger>();
    let config = mock<IObsConfig>();
    let obs = createMock();
    mockSendInit(obs).mockResolvedValueOnce();

    let obsController = new ObsController(config, obs, logger);

    obsController.connect().then((err) => {
        expect(logger.warn).toBeCalledTimes(0);
        expect(logger.info).toBeCalledTimes(2);
        expect(err).toBeUndefined();
        done();
    });

    // obsController.switchToScene(TestSceneName);

    // expect(obs.send).toHaveBeenCalledTimes(2);
});

test('setText', () => {
    let logger = mock<ILogger>();
    let config = mock<IObsConfig>();
    let obs = createMock();
    let obsController= new ObsController(config, obs, logger);
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
});