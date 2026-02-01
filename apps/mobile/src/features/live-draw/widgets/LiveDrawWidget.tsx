import React from 'react';
import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';

interface LiveDrawWidgetProps {
  imageBase64?: string;
}

export function LiveDrawWidget({ imageBase64 }: LiveDrawWidgetProps) {
  if (imageBase64) {
    return (
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 'match_parent',
          backgroundColor: '#1a1a2e',
          padding: 8,
          borderRadius: 16,
        }}
        clickAction="OPEN_APP"
        clickActionData={{ uri: 'app.sauci://live-draw' }}
      >
        <ImageWidget
          image={`data:image/png;base64,${imageBase64}`}
          imageWidth={284}
          imageHeight={94}
          style={{
            width: 'match_parent',
            height: 'match_parent',
            borderRadius: 12,
          }}
        />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
      }}
      clickAction="OPEN_APP"
      clickActionData={{ uri: 'app.sauci://live-draw' }}
    >
      <TextWidget
        text="✏️"
        style={{ fontSize: 32 }}
      />
      <TextWidget
        text="Draw together"
        style={{ fontSize: 12, color: '#80FFFFFF', marginTop: 8 }}
      />
    </FlexWidget>
  );
}
