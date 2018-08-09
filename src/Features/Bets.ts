import * as mp from "../MessageProcessor";
import { Context } from "../../app";
import { Logger } from "../Logger";

enum State {
    Idle,
    Open,
    WaitingForResult
}

interface IAnswer {
    user: string;
    text: string;
}

/** Often twitch bets are done by betting a virtual currency and wawiting for a RNG.
 * This is different, and shall enable betting real results.
 */
export class Bets implements mp.IFeature {
    public trigger: string = "bet";
    private logger: Logger;
    private state: State;
    private answers: IAnswer[] = [];

    constructor(context: Context) {
        this.logger = context.logger;
        this.state = State.Idle;
    }

    /** Return the message we just received */
    public act(msg: mp.Message, callback: mp.ResponseCallback): void {
        let answerText: string = "";


        let payload = msg.text.split(" ");
        /* let trigger = */ payload.splice(0, 1);
        let command = payload[0];

         // TODO check admin
        if(msg.from.toLowerCase() == "vash1080")
        {
            if(this.state == State.Idle && command.toLowerCase() == "open")
            {
                this.state = State.Open;
                answerText = "Place your bet by entering !bet <choice>";
            }

            if(this.state == State.Open && command.toLowerCase() == "close")
            {
                this.state = State.WaitingForResult;
                answerText = "Bets are closed!";
                // TODO write all answers to report
            }

            if(this.state == State.WaitingForResult && command.toLowerCase() == "result")
            {
                payload.splice(0, 1);
                let result = payload.join(" ");
                let resultLower = result.toLowerCase();

                this.state = State.Idle;                

                let winners = this.answers.filter(a => a.text.toLowerCase() == resultLower);
                let winnerNames = winners.map(w => w.user);
                let winnerText = winnerNames.join(", ");

                answerText = "Winners: " + winnerText;
                // TODO write winners to report

                this.answers.length = 0;
            }
        } 
        else if (this.state == State.Open) 
        {
            let betText = payload.join(" ");
            let answer = this.answers.find(a => a.user == msg.from);
            if (answer == undefined) 
            {
                let newAnswer: IAnswer = {
                    user: msg.from,
                    text: betText
                };
                this.answers.push(newAnswer);
            } 
            else 
            {
                answer.text = betText;
            }
        }
        

        if (answerText != "")
        {
            let answer = new mp.Message({
                from: "",
                channel: msg.channel,
                text: answerText
            });
    
            let response = { message: answer };
            callback(null, response);
        }
    }
}

export default Bets;