const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { Consulting } = require('./gemini');
const { ConsultingOpenAI, createCharacter } = require('./openaiScript.js');
const { commands, checkServer } = require('./commands/index.js');
const { Rules } = require('./commands/rules.js');
const { LoadCustomCommandMap } = require('./commands/custom/index.js');
const { CreateCustomCommandMapRefresher } = require('./commands/custom/refresh.js');
const { RunCustomCommand } = require('./commands/custom/runner.js');
const { CreateScheduledTaskRegistry } = require('./commands/scheduledTasks/index.js');
const { CreateScheduledTaskRefresher } = require('./commands/scheduledTasks/refresh.js');
const {
    EnforceChannelRules,
    RefreshChannelRuleCache,
} = require('./commands/channelRules/index.js');
const {
    Server,
    SettingWelcome,
    ContadorCommand,
    WelcomeCard,
    CustomCommand,
    ScheduledTask,
} = require('./db/index.js');
const { WelcomeCardRenderer } = require('./commands/util/welcomeCard.js');
const { ManageInteraction } = require('./interaction/index.js');
const { SlashCommands } = require('./slash command/index.js');
const { SlashLib } = require('./slash command/lib.js');
const { LibAutocomplete } = require('./slash command/lib-autocomplete.js');
const { RUNTIME_BOT } = require('./library/index.js');
const {
    CreateCounterInactivityProcessor,
    StartCounterInactivityScheduler,
} = require('./commands/counter/inactivity.js');
const {
    AutoCleanMessageRepository,
    CreateAutoCleanMessageRuntime,
    CreateAutoCleanMessageRefresher,
    StartAutoCleanMessageScheduler,
} = require('./commands/autoCleanMessage/index.js');
const {
    GhostMessageRepository,
    CreateGhostMessageRuntime,
    CreateGhostMessageRefresher,
    StartGhostMessageSweeper,
} = require('./commands/ghostMessage/index.js');

const { CronJob } = require('cron');

require('dotenv').config();
const token = process.env.token;

const library = new RUNTIME_BOT();


const ServerDb = new Server();
const settingWelcome = new SettingWelcome();
const counterDb = new ContadorCommand();
const welcomeCardDb = new WelcomeCard();
const welcomeCard = new WelcomeCardRenderer();
const customCommandDb = new CustomCommand();
const scheduledTaskDb = new ScheduledTask();
const autoCleanMessageDb = new AutoCleanMessageRepository();
const ghostMessageDb = new GhostMessageRepository();

const customCommandMapRefresher = CreateCustomCommandMapRefresher({
    getChangeSignature: () => customCommandDb.GetChangeSignature(),
    loadCustomCommandMap: LoadCustomCommandMap,
});
const refreshCustomCommandMap = customCommandMapRefresher.refreshCustomCommandMap;

let customCommandRefreshCron = null;
let channelRuleRefreshCron = null;
let scheduledTaskRefreshCron = null;
let refreshScheduledTasks = null;
let counterInactivityInterval = null;
let autoCleanMessageRefreshCron = null;
let ghostMessageRefreshCron = null;

const startCustomCommandRefreshCron = () => {
    if (customCommandRefreshCron !== null) {
        return;
    }

    customCommandRefreshCron = new CronJob(
        '*/10 * * * * *',
        refreshCustomCommandMap,
        null,
        true,
        'America/Argentina/Buenos_Aires'
    );
};

const startChannelRuleRefreshCron = () => {
    if (channelRuleRefreshCron !== null) {
        return;
    }

    channelRuleRefreshCron = new CronJob(
        '*/10 * * * * *',
        RefreshChannelRuleCache,
        null,
        true,
        'America/Argentina/Buenos_Aires'
    );
};

const startScheduledTaskRefreshCron = () => {
    if (scheduledTaskRefreshCron !== null || refreshScheduledTasks === null) {
        return;
    }

    scheduledTaskRefreshCron = new CronJob(
        '*/10 * * * * *',
        refreshScheduledTasks,
        null,
        true,
        'America/Argentina/Buenos_Aires'
    );
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.AutoModerationExecution
    ]
});

const scheduledTaskRegistry = CreateScheduledTaskRegistry({
    client,
    getEnabledTasks: () => scheduledTaskDb.GetEnabled(),
});
const scheduledTaskRefresher = CreateScheduledTaskRefresher({
    getChangeSignature: () => scheduledTaskDb.GetChangeSignature(),
    reconcileScheduledTasks: scheduledTaskRegistry.reconcileScheduledTasks,
});
refreshScheduledTasks = scheduledTaskRefresher.refreshScheduledTasks;
const counterInactivityProcessor = CreateCounterInactivityProcessor({
    counterDb,
    client,
    logger: console,
});
const autoCleanMessageRuntime = CreateAutoCleanMessageRuntime({
    client,
    repository: autoCleanMessageDb,
    logger: console,
});
const autoCleanMessageRefresher = CreateAutoCleanMessageRefresher({
    getChangeSignature: () => autoCleanMessageDb.GetChangeSignature(),
    getEnabledConfigurations: () => autoCleanMessageDb.GetEnabled(),
    reconcile: autoCleanMessageRuntime.reconcile,
    logger: console,
});
const autoCleanMessageScheduler = StartAutoCleanMessageScheduler({
    runDue: autoCleanMessageRuntime.runDue,
    logger: console,
});
const ghostMessageRuntime = CreateGhostMessageRuntime({ client, logger: console });
const ghostMessageRefresher = CreateGhostMessageRefresher({
    getChangeSignature: () => ghostMessageDb.GetChangeSignature(),
    getEnabledConfigurations: () => ghostMessageDb.GetEnabled(),
    reconcile: ghostMessageRuntime.reconcile,
    logger: console,
});
const ghostMessageSweeper = StartGhostMessageSweeper({
    runSweep: ghostMessageRuntime.runSweep,
    logger: console,
});

const startMessageCleanupRefreshCrons = () => {
    if (autoCleanMessageRefreshCron === null) {
        autoCleanMessageRefreshCron = new CronJob(
            '*/10 * * * * *',
            autoCleanMessageRefresher.refresh,
            null,
            true,
            'America/Argentina/Buenos_Aires'
        );
    }
    if (ghostMessageRefreshCron === null) {
        ghostMessageRefreshCron = new CronJob(
            '*/10 * * * * *',
            ghostMessageRefresher.refresh,
            null,
            true,
            'America/Argentina/Buenos_Aires'
        );
    }
};

const startCounterInactivityScheduler = () => {
    if (counterInactivityInterval !== null) return;

    counterInactivityInterval = StartCounterInactivityScheduler({
        run: counterInactivityProcessor.run,
        logger: console,
    });
};

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    SlashCommands(client);

    await refreshCustomCommandMap();
    await RefreshChannelRuleCache();
    await refreshScheduledTasks();
    await autoCleanMessageRefresher.refresh();
    await ghostMessageRefresher.refresh();

    startCustomCommandRefreshCron();
    startChannelRuleRefreshCron();
    startScheduledTaskRefreshCron();
    startCounterInactivityScheduler();
    startMessageCleanupRefreshCrons();
    autoCleanMessageScheduler.start();
    ghostMessageSweeper.start();

    // Una pasada al arrancar atiende una ejecución vencida durante el downtime
    // una sola vez; las siguientes fechas se calculan desde su finalización.
    await autoCleanMessageScheduler.runSafely();
    await ghostMessageSweeper.runSafely();

    const cron = new CronJob('0 0 0 * * *',
        () => {
            console.log('Start runtime');
            library.birthday_runtime(client);
        },
        null,
        true,
        'America/Argentina/Buenos_Aires');

    // Sincroniza los gifs de todos los servidores 3 veces al dia: 08:00, 14:00 y 21:00
    const cronGifs = new CronJob('0 0 8,14,21 * * *',
        () => {
            console.log('Start sync gifs');
            library.gif_runtime(client);
        },
        null,
        true,
        'America/Argentina/Buenos_Aires');

});

client.on('messageCreate', async (msg) => {
    console.log(`Message received: ${msg.content} from ${msg.guild.name}`);
    // Rules registra el mensaje en la cola del contador de forma síncrona. Se
    // guarda la promesa antes de cualquier await para conservar el orden real
    // en el que Discord emitió los eventos messageCreate.
    const channelRuleResult = EnforceChannelRules(msg);
    const counterRule = Rules(
        msg,
        { shouldProcess: channelRuleResult.then((result) => !result.handled) }
    );

    try {
        const resolvedChannelRule = await channelRuleResult;
        if (resolvedChannelRule.handled) {
            await counterRule;
            return;
        }

        await checkServer(msg.guild);
        let admin = false;
        let isMod = false;
        if (msg != null) {
            admin = msg.member.permissions.has(PermissionsBitField.Flags.Administrator);
            isMod = msg.member.permissions.has(
                PermissionsBitField.Flags.KickMembers,
                PermissionsBitField.Flags.BanMembers,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.ManageChannels
            );
        }
        await RunCustomCommand(client, msg);
        const isCounterChannel = await counterRule;
        await commands(client, msg, ConsultingOpenAI, admin, isMod, userIsSubOrBooster, createCharacter, isCounterChannel);
    } catch (error) {
        console.error('Error al manejar el mensaje:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        let admin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator),
            isMod = interaction.member.permissions.has(
                PermissionsBitField.Flags.KickMembers,
                PermissionsBitField.Flags.BanMembers,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.ManageChannels
            );
        if (interaction.isChatInputCommand() ||
            interaction.isUserContextMenuCommand() ||
            interaction.isMessageContextMenuCommand()) {
            console.log('Comando chat  invocado:', interaction.isChatInputCommand());
            try {
                await SlashLib(client, isMod, admin, interaction);
            } catch (error) {
                console.error('Error al ejecutar el comando de barra:', error);
            }
        }

        // Los modales entran por acá. Sin esta rama, el formulario de ticket se envía y
        // no lo recibe nadie: era lo que rompía crear y cerrar tickets.
        if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
            await ManageInteraction(client, interaction);
        }

        if (interaction.isAutocomplete()) {
            await LibAutocomplete(client, interaction, isMod, admin);
        }

    } catch (error) {
        console.error('Error al manejar la interacción:', error);
    }
});


// Cuando agregan el bot a un servidor nuevo, sincroniza sus gifs al toque
client.on('guildCreate', async (guild) => {
    console.log(`Bot agregado al servidor: ${guild.name} (${guild.id})`);
    library.gif_runtime_server(guild.id);
});


client.on('guildMemberAdd', async (member) => {

    // 1. Rol automático de bienvenida
    try {
        const settingWelcomeData = await settingWelcome.GetById(member.guild.id);
        if (settingWelcomeData.length > 0) {
            const roleId = settingWelcomeData[0].setRole;
            await member.roles.add(roleId);
        }
    } catch (error) {
        console.log('[guildMemberAdd] no se pudo asignar el rol:', error.message);
    }

    // 2. Imagen de bienvenida. Va en su propio try: si falla el dibujo o el envío,
    //    el rol de arriba ya quedó asignado igual.
    try {
        const card = await welcomeCardDb.GetOne(member.guild.id);

        if (!card || !card.enabled || !card.channelId) return;

        const channel = await member.guild.channels.fetch(card.channelId);
        if (!channel) return;

        await channel.send(await welcomeCard.BuildMessage(card, member));
    } catch (error) {
        console.log('[guildMemberAdd] no se pudo enviar la bienvenida:', error.message);
    }
});

async function userIsSubOrBooster(member) {
    // 1. Server booster (rol con .tags.premium_subscriber === true)
    const isBooster = member.roles.cache.some(role => role.tags?.premium_subscriber);

    // 2. Twitch sub: busca rol que empiece con "Twitch Subscriber:" o "Suscriptor de Twitch:"
    const isTwitchSub = member.roles.cache.some(role =>
        role.name.startsWith("Twitch Subscriber:") ||
        role.name.startsWith("Suscriptor de Twitch:")
    );

    return isBooster || isTwitchSub;
}

client.login(token);
