const { buttonFollowing } = require("../db");

const {interactionLib} = require("./lib.js");

const btnfollow = new buttonFollowing();


const ManageInteraction = async (interaction)=>{
    let lib = new interactionLib();

    let dto = (await btnfollow.GetById(interaction.guild.id))[0];
    let label_id = dto.setChannel;

    if(interaction.customId.includes('Following ' + label_id)){
        lib.BtnFollowing(interaction, dto.setRole, label_id);
    }
}

module.exports = {
    ManageInteraction,
}