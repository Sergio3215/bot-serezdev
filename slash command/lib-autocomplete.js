
async function LibAutocomplete(client, interaction, isMod, isAdmin) {
    if (interaction.commandName === 'contador' && (isAdmin || isMod)) {
        let list = await interaction.guild.channels.fetch();
        const channels = list
        .filter(c => c.type === 0 && !(c.name.toLowerCase().includes('stream')) && !(c.name.toLowerCase().includes('ticket')) && !(c.name.toLowerCase().includes('meme')) && !(c.name.toLowerCase().includes('youtube')) && !(c.name.toLowerCase().includes('twitch')) && !(c.name.toLowerCase().includes('tiktok')) && !(c.name.toLowerCase().includes('kick')) && !(c.name.toLowerCase().includes('patreon')) && !(c.name.toLowerCase().includes('spoiler')) && !(c.name.toLowerCase().includes('setting')) && !(c.name.toLowerCase().includes('bot')) && !(c.name.toLowerCase().includes('redes'))&& !(c.name.toLowerCase().includes('clips'))&& !(c.name.toLowerCase().includes('mod'))&& !(c.name.toLowerCase().includes('admin')))
        .map(c => ({ name: c.name, id: c.id }));
        // console.log('Channels for autocomplete:', channels);
        ListChannels(channels, interaction);
    }
}

// 👇 handler de autocompletado (máx 25 sugerencias)
async function ListChannels(channels, interaction) {
    const focused = interaction.options.getFocused(true);
    const query = focused.value.toLowerCase();

    const filtered = channels.filter(value => value.name.toLowerCase().includes(query.toLowerCase()))

    await interaction.respond(
        filtered.map(value => ({ name: value.name, value: value.id })).slice(0, 25)
    );
}

module.exports = { LibAutocomplete };