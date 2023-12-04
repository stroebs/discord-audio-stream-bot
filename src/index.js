const { ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits, VoiceChannel } = require('discord.js');
const { getVoiceConnection, joinVoiceChannel } = require('@discordjs/voice');
const dotenv = require('dotenv');
const portAudio = require('naudiodon');

const createStream = require('./stream');

dotenv.config();

/**
 * Initialize.
 *
 * @returns {Promise<void>}
 *
 * @since 1.0.0
 */
async function initialize() {
  /**
   * Discord configuration.
   *
   * @since 1.0.0
   */
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
  ];
  const client = new Client(
    {intents},
  );

  /**
   * Audio device setup.
   *
   * @since 1.0.0
   */
  inquirer = (await import('inquirer')).default;
  const { device: deviceName } = await inquirer.prompt([{
    type: 'list',
    name: 'device',
    message: 'Choose the output audio device to stream on Discord:',
    choices: portAudio.getDevices(),
  }]);
  const audioDevice = portAudio.getDevices().find((device) => device.name === deviceName);

  /**
   * When client is ready.
   *
   * @since 1.0.0
   */
  client.on(Events.ClientReady, async () => {
    let player;
    let voiceConnection;

    /**
     * Server ready signal.
     *
     * @since 1.0.0
     */
    console.log('Server is ready ...');

    /**
     * Create a device player stream.
     *
     * @since 1.0.0
     */
    try {
      player = createStream(client, audioDevice);
    } catch (error) {
      await client.user.setStatus('invisible');

      console.error(error.message);
      process.exit(0);
    }

    /**
     * Set user status.
     *
     * @since 1.0.0
     */
    await client.user.setStatus('online');

    /**
     * Message embed template.
     *
     * @param {string} title   - Message embed title.
     * @param {string} content - Message embed content.
     *
     * @returns {module:"discord.js".EmbedBuilder}
     *
     * @since 1.0.0
     */
    const messageEmbedTemplate = (title, content) => new EmbedBuilder()
      .setColor('#7289da')
      .setTitle(title)
      .setDescription(content)
      .setTimestamp()
      .setFooter({ text: 'Discord Audio Stream Bot' });

    /**
     * Get voice channel by name.
     *
     * @param {string} channel - Discord channel object.
     * @param {string} content - Required channel name.
     *
     * @returns {module:"discord.js".VoiceChannel}
     *
     * @since 2.0.0
     */
    const getVoiceChannelByName = (channel, channelName) => {
      return channel.guild.channels.cache.find(
        (channel) => channel.type === ChannelType.GuildVoice && channel.name === channelName
      );
    };

    /**
     * Voice controller.
     *
     * @param {string}      action    - You can "join", "leave", "play", or "stop".
     * @param {Guild}       guild     - Discord guild information.
     * @param {NewsChannel} channel   - Discord channel functions.
     * @param {string|null} channelId - Voice channel id.
     *
     * @since 1.0.0
     */
    const voiceController = async (action, guild, channel, channelId = null) => {
      const voiceChannel = client.channels.cache.get(channelId);
      const connectedTo = guild.members.cache.get(client.user.id)?.voice.channel;
      voiceConnection = getVoiceConnection(guild.id);

      if (
        (!voiceChannel && action !== 'stop')
        || (voiceChannel && voiceChannel.type !== ChannelType.GuildVoice)
      ) {
        console.error(`The voice channel (${channelId}) is invalid or does not exist ...`);
        await channel.send(
          {
            embeds: [messageEmbedTemplate('Error', `The voice channel (${channelId}) is invalid or does not exist.`)],
          }
        );

        return;
      }

      switch (action) {
        case 'play':
          try {
              const connection = joinVoiceChannel({
                  channelId: voiceChannel.id,
                  guildId: voiceChannel.guild.id,
                  adapterCreator: voiceChannel.guild.voiceAdapterCreator,
              });

              console.log(`Connected to voice channel (${channelId}) ...`);
              connection.subscribe(player);

              await channel.send({
                  embeds: [messageEmbedTemplate('Connected', `Now connected and streaming audio to <#${channelId}>`)],
              });
          } catch (error) {
              console.error(`${error.message.replace(/\\.$/, '')} ...`);
              await channel.send({
                  embeds: [messageEmbedTemplate('Error', `Cannot connect to voice channel (${channelId}). Check logs for more details.`)],
              });
          }
          break;
        case 'stop':
          if (voiceConnection) {
            player.stop();
            voiceConnection.destroy();
            console.log(`Disconnected from voice channel (${connectedTo.id}) ...`);

            await channel.send(
              {
                embeds: [messageEmbedTemplate('Disconnected', `Now disconnected from <#${connectedTo.id}>`)],
              }
            );
          } else {
            console.log('Not connected to any voice channel ...');

            await channel.send(
              {
                embeds: [messageEmbedTemplate('Error', 'Cannot disconnect from voice channel. Check logs for more details.')],
              }
            );
          }
          break;
        default:
          break;
      }
    };

    /**
     * Listen for Discord server messages.
     *
     * @since 1.0.0
     */
    client.on(Events.MessageCreate, async (message) => {
      const {
        guild,
        channel,
        mentions,
      } = message;
      const mentioned = mentions.users;
      const clientId = client.user.id;
      const [username, command, channelId] = message.content.split(' ');

      // If bot was not tagged, skip.
      if (!mentioned.get(clientId)) {
        return;
      }

      // Command help menu.
      if (!command || command === 'help') {
        const mentionedUsername = mentioned.get(clientId).username;

        console.log('Displaying command help menu ...');

        await channel.send(
          {
            embeds: [messageEmbedTemplate(
              'Command Help Menu',
              [
                `\`@${mentionedUsername} help\`\nDisplay the help menu (this list)`,
                `\`@${mentionedUsername} list\`\nSee a list of available voice channels`,
                `\`@${mentionedUsername} play <channel id>\`\nJoin channel and start playing audio`,
                `\`@${mentionedUsername} stop\`\nStop playing audio and leave channel`,
              ].join('\n\n'),
            )]
          }
        );
      }

      // Voice channel list.
      if (command === 'list') {
        const voiceChannels = channel.guild.channels.cache.filter((theChannel) => theChannel.type === ChannelType.GuildVoice);

        console.log('Displaying voice channel list ...');
        await channel.send(
          {
            embeds: [messageEmbedTemplate(
              'Voice Channels List',
              [
                `Use the channel name or ID below with the \`join\`, \`play\`, \`stop\` commands. Please make sure these channels are viewable by ${username}.\n`,
                ...voiceChannels.map((theChannel) => `${theChannel.name} ➜ \`${theChannel.id}\``),
              ].join('\n'),
            )]
          }
        );
      }

      // Start playing in voice channel.
      if (command === 'play' && channelId) {
        console.log(`Connecting to voice channel (${channelId}) ...`);
        let joinChannelId = channelId;
        
        if (!channelId.match(/^\d{18}$/g)) {
          joinChannelId = getVoiceChannelByName(channel, channelId).id;
        }

        await voiceController('play', guild, channel, joinChannelId);
      }

      // Stop playing in voice channel.
      if (command === 'stop') {
        console.log('Disconnecting from voice channel ...');

        await voiceController('stop', guild, channel);
      }
    });

    /**
     * Capture SIGINT (Control+C).
     *
     * @since 1.0.0
     */
    process.on('SIGINT', () => {
      console.log(`Setting status to invisible`);
      client.user.setStatus('invisible');
      console.log(`Leaving voice channels`);
      client.guilds.cache.forEach(guild => {
        const voiceConnection = getVoiceConnection(guild.id);
        if (voiceConnection) {
          voiceConnection.destroy();
          console.log(`Left voice channel in guild: ${guild.name}`);
        }
      });
      console.log(`Disconnecting from Discord`);
      client.destroy();

      console.log('Stopping server ...');
      process.exit(130);
    });
  });

  /**
   * Client login.
   *
   * @since 1.0.0
   */
  await client.login(process.env.DISCORD_CLIENT_TOKEN);
}

/**
 * Initialize server.
 *
 * @since 1.0.0
 */
initialize().then(() => {
  console.log('Initializing server ...');
});
