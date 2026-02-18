// Text formatting utilities for React Native

export interface FormattedTextSegment {
  text: string;
  style?: 'bold' | 'italic' | 'code' | 'normal';
}

export const parseFormattedText = (text: string): FormattedTextSegment[] => {
  const segments: FormattedTextSegment[] = [];
  let currentText = '';
  let currentStyle: 'bold' | 'italic' | 'code' | 'normal' = 'normal';
  
  // Simple markdown-like parser
  const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/);
  
  tokens.forEach((token) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      // Bold text
      if (currentText) {
        segments.push({ text: currentText, style: currentStyle });
        currentText = '';
      }
      segments.push({ text: token.slice(2, -2), style: 'bold' });
    } else if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      // Italic text
      if (currentText) {
        segments.push({ text: currentText, style: currentStyle });
        currentText = '';
      }
      segments.push({ text: token.slice(1, -1), style: 'italic' });
    } else if (token.startsWith('`') && token.endsWith('`')) {
      // Code text
      if (currentText) {
        segments.push({ text: currentText, style: currentStyle });
        currentText = '';
      }
      segments.push({ text: token.slice(1, -1), style: 'code' });
    } else {
      currentText += token;
    }
  });
  
  if (currentText) {
    segments.push({ text: currentText, style: currentStyle });
  }
  
  return segments;
};

// Clean markdown from text
export const cleanMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markers
    .replace(/\*(.*?)\*/g, '$1') // Remove italic markers
    .replace(/`(.*?)`/g, '$1') // Remove code markers
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove link markers
    .replace(/^#+\s*/gm, '') // Remove heading markers
    .replace(/^\s*[-*+]\s*/gm, '• ') // Convert list markers
    .trim();
};

// Remove emojis from text
export const removeEmojis = (text: string): string => {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Symbols
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Arrows
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Extended
    .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // Variation selectors
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/\s{2,}/g, ' ') // Clean up double spaces
    .trim();
};

// Clean AI response - remove markdown and emojis
export const cleanAIResponse = (text: string): string => {
  return removeEmojis(cleanMarkdown(text));
};

// Format search results for better display
export const formatSearchResults = (query: string, results: any[]): string => {
  let formattedText = `Web Search Results for: "${query}"\n\n`;
  
  results.forEach((result, index) => {
    formattedText += `${index + 1}. ${result.title}\n`;
    if (result.snippet) {
      formattedText += `${result.snippet}\n`;
    }
    formattedText += `Source: ${result.link}\n\n`;
  });
  
  return formattedText;
}; 