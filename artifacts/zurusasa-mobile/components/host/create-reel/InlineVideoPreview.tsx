import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createReelStyles as styles } from './createReelStyles';

export interface InlineVideoPreviewProps {
  uri: string;
  onChangeVideo: () => void;
}

export function InlineVideoPreview({ uri, onChangeVideo }: InlineVideoPreviewProps) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });

  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  return (
    <View style={styles.videoPreviewWrap}>
      <VideoView
        player={player}
        style={styles.videoPreviewView}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable style={styles.videoPlayOverlay} onPress={togglePlay}>
        <View style={styles.videoPlayBtnCircle}>
          <Feather name={playing ? 'pause' : 'play'} size={22} color="#FFFFFF" />
        </View>
      </Pressable>

      <Pressable style={styles.videoChangeBadge} onPress={onChangeVideo}>
        <Feather name="refresh-cw" size={12} color="#FFFFFF" />
        <Text style={styles.videoChangeBadgeText}>Change Video</Text>
      </Pressable>
    </View>
  );
}
