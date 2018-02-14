import * as MP from "./src/MessageProcessor";
import { Loopback } from "./src/Plugins/Loopback";
import * as IRC from "irc";
import { Configuration } from "./src/Configuration";

class Startup {
    public static main(): number {

        let config = new Configuration();

        let client = new IRC.Client(
            config.server,
            config.nickname,
            {
                autoConnect: false,
                password: config.password
            }
        );

        let proc = new MP.MessageProcessor();
        
        let plg = new Loopback("");
        proc.registerPlugin(plg);

        let plg2 = new Loopback("test");
        proc.registerPlugin(plg2);

        client.addListener("raw", message => {
            console.log("raw: ", message);
        });

        client.addListener("error", message => {
            console.log("error: ", message);
        });

        client.addListener("message", (from, to, message) => {
            let m = new MP.Message({from: from, channel: to, text: message});
            proc.process(m);
        });

        client.connect(() => {

            client.join(config.channel);

            client.say(config.channel, "I'm a bot!");

        });

        return 0;
    }
}

Startup.main();