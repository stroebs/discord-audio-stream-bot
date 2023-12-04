const portAudio = require('naudiodon');
const {
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus
} = require('@discordjs/voice');

/**
 * Create stream.
 *
 * Discord expects raw audio streams to be 2-channels,
 * signed 16-bits, and have a 48000Hz sample rate.
 *
 * @param {module:"discord.js".Client} client - Discord.js client.
 * @param {Device | undefined}         device - Audio device from Naudiodon.
 *
 * @since 1.0.0
 */
module.exports = function createStream(client, device) {
  if (
    device.defaultSampleRate !== 48000
  ) {
    throw Error(`${device.name} is not a supported audio device ...`);
  }

  // Create the broadcast stream.
  const player = createAudioPlayer();

  // Create the audio device stream.
  const audio = new portAudio.AudioIO({
    inOptions: {
      channelCount: 2,
      sampleFormat: portAudio.SampleFormat16Bit,
      sampleRate: 48000,
      deviceId: device.id,
      closeOnError: false,
    },
  });

  // Create an audio resource from the audio input stream
  const resource = createAudioResource(audio, {
    inputType: StreamType.Raw
  });

  // Create a dispatcher for our audio stream.
  player.play(resource);

  audio.start();

  // Handle end of audio and errors
  player.on(AudioPlayerStatus.Idle, () => connection.destroy());
  player.on('error', error => console.error(error));

  return player;
};
