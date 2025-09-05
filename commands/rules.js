
const Rules = () => {

    //💀 LA MORGUE 💀

    //console.log(msg.channel.id); id: '1413026508276236351', name: '😆video-reaccion-en-stream😆'
    //console.log(msg.guild); id: '748652112485023854', name: '💀 LA MORGUE 💀'

    if (msg.guild.id == "748652112485023854") {
        if (msg.channel.id == "1413026508276236351") {
            if (!msg.content.includes("https://www.youtube.com/") && !msg.content.includes("https://youtu.be")) {
                msg.delete();
            }
        }
    }
}

module.exports = {
    Rules
};