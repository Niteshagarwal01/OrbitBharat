import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Linking,
  Dimensions,
  Animated,
  Easing
} from 'react-native';
import {
  MessageCircle,
  Send,
  Cpu,
  Zap,
  Globe,
  Rocket,
  Sun,
  Activity,
  Brain,
  Sparkles,
  ChevronLeft,
  MoreVertical
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import LottieView from 'lottie-react-native';
import { APP_CONFIG } from '../utils/constants';
import { API_CONFIG, isApiConfigured, buildSearchUrl } from '../utils/apiConfig';
import { logger } from '../utils/logger';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { localSolarLLM } from '../utils/localLLM';
import { cleanMarkdown, formatSearchResults, cleanAIResponse } from '../utils/textFormatter';
import { generateGeminiResponse, isGeminiConfigured } from '../utils/geminiApi';
import ParticleBackground from '../components/ParticleBackground';

type Props = NativeStackScreenProps<RootStackParamList, 'Chatbot'>;

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  source?: 'web' | 'model' | 'local_llm';
  searchResults?: SearchResult[];
}

type ResponseMode = 'web' | 'model';

const quickQuestions = [
  { text: 'What is our CME prediction?', icon: Activity },
  { text: 'Tell me about Aditya-L1', icon: Rocket },
  { text: 'Current space weather?', icon: Sun },
  { text: 'How does the ML model work?', icon: Cpu },
  { text: 'What are X-class flares?', icon: Zap },
  { text: 'Aurora forecast?', icon: Globe },
];

const { width } = Dimensions.get('window');

export default function ChatbotScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Welcome to OrbitBharat AI! I\'m your space weather assistant powered by Gemini 2.5 Flash with real-time DSCOVR data and our custom ML model.\n\nI can help you with:\n• Solar activity & CME analysis\n• Aditya-L1 mission details\n• Our ML prediction model\n• Space weather impacts\n\nWhat would you like to know?',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [responseMode, setResponseMode] = useState<ResponseMode>('model');
  const scrollViewRef = useRef<ScrollView>(null);

  // Render formatted AI text with markdown-like styling
  const renderFormattedText = (text: string) => {
    // Clean text first - remove emojis and markdown
    const cleanedText = cleanAIResponse(text);
    // Split by lines to handle bullets
    const lines = cleanedText.split('\n');
    return (
      <View>
        {lines.map((line, lineIndex) => {
          if (!line.trim()) return <View key={lineIndex} style={{ height: 8 }} />;
          const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
          return (
            <Text
              key={lineIndex}
              style={[
                styles.aiText,
                isBullet && styles.bulletLine,
              ]}
            >
              {line}
            </Text>
          );
        })}
      </View>
    );
  };

  // Header Animation
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerOpacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSendMessage = async () => {
    if (inputText.trim() === '') return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      let response: string;
      let source: 'web' | 'model' | 'local_llm';
      let searchResults: SearchResult[] | undefined;

      if (responseMode === 'web') {
        if (!isApiConfigured()) {
          response = 'Web search requires API configuration. Please set up your Google Search API key.';
          source = 'web';
        } else {
          const searchData = await performWebSearch(inputText);
          response = searchData.responseText;
          searchResults = searchData.results;
          source = 'web';
        }
      } else {
        if (!isGeminiConfigured()) {
          response = generateLocalResponse(inputText);
          source = 'local_llm';
        } else {
          response = await generateModelResponse(inputText);
          source = 'model';
        }
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date(),
        source,
        searchResults,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      logger.error('Error generating response', { error }, 'ChatbotScreen');
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date(),
        source: responseMode,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }

    logger.info('Message sent', { text: inputText, mode: responseMode }, 'ChatbotScreen');
  };

  const performWebSearch = async (query: string): Promise<{ responseText: string; results: SearchResult[] }> => {
    try {
      const url = buildSearchUrl(query, 'image');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Web search failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const results: SearchResult[] = data.items.slice(0, API_CONFIG.WEB_SEARCH.max_results).map((item: any) => ({
          title: cleanMarkdown(item.title),
          snippet: cleanMarkdown(item.snippet || item.title),
          link: item.link,
          imageUrl: item.image?.thumbnailLink || item.image?.src || item.link,
          imageWidth: item.image?.thumbnailWidth || 150,
          imageHeight: item.image?.thumbnailHeight || 150,
        }));

        const responseText = formatSearchResults(query, results);

        return { responseText, results };
      } else {
        return {
          responseText: `No web search results found for "${query}". Try rephrasing your question.`,
          results: []
        };
      }
    } catch (error) {
      logger.error('Web search error', { error }, 'ChatbotScreen');
      return {
        responseText: 'Web search is currently unavailable. Please try the AI model mode instead.',
        results: []
      };
    }
  };

  const generateModelResponse = async (query: string): Promise<string> => {
    try {
      if (isGeminiConfigured()) {
        console.log('[ChatBot] Calling Gemini API for:', query.substring(0, 50));
        const geminiResponse = await generateGeminiResponse(query, true);
        console.log('[ChatBot] Gemini response source:', geminiResponse.source);

        // Accept any successful response from Gemini (gemini, ml-enhanced, or even fallback with text)
        if (geminiResponse.source !== 'fallback' || geminiResponse.text.length > 100) {
          return cleanAIResponse(geminiResponse.text);
        }
      }
      console.log('[ChatBot] Falling back to local LLM');
      return cleanAIResponse(generateLocalResponse(query));
    } catch (e) {
      console.error('[ChatBot] Error calling Gemini:', e);
      return cleanAIResponse(generateLocalResponse(query));
    }
  };

  const generateLocalResponse = (query: string): string => {
    // Use existing local LLM logic
    const localResponse = localSolarLLM.generateResponse(query);
    return cleanAIResponse(localResponse.text);
  };

  const handleQuickQuestion = (question: string) => {
    setInputText(question);
    // Optional: auto-send
    // handleSendMessage(); 
  };

  return (
    <ParticleBackground>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* Glass Header */}
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <GlassCard style={styles.headerBlur}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => navigation.navigate('Landing')} style={styles.backButton}>
                <ChevronLeft size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>Solar AI Assistant</Text>
                <View style={styles.headerStatus}>
                  <View style={[styles.statusDot, { backgroundColor: APP_CONFIG.colors.success }]} />
                  <Text style={styles.statusText}>Online • Level 2 Access</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.menuButton}>
                <MoreVertical size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Mode Toggle */}
        <View style={styles.modeToggleContainer}>
          <GlassCard style={styles.toggleBlur}>
            <TouchableOpacity
              style={[styles.toggleBtn, responseMode === 'model' && styles.activeToggle]}
              onPress={() => setResponseMode('model')}
            >
              <Sparkles size={14} color={responseMode === 'model' ? '#FFF' : '#AAA'} />
              <Text style={[styles.toggleText, responseMode === 'model' && styles.activeToggleText]}>AI Model</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, responseMode === 'web' && styles.activeToggle]}
              onPress={() => setResponseMode('web')}
            >
              <Globe size={14} color={responseMode === 'web' ? '#FFF' : '#AAA'} />
              <Text style={[styles.toggleText, responseMode === 'web' && styles.activeToggleText]}>Web Search</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Questions Grid */}
            {messages.length === 1 && (
              <View style={styles.quickGrid}>
                {quickQuestions.map((q, i) => (
                  <TouchableOpacity key={i} onPress={() => handleQuickQuestion(q.text)} style={styles.quickCard}>
                    <GlassCard style={styles.quickCardInner}>
                      <q.icon size={20} color={APP_CONFIG.colors.accent} style={{ marginBottom: 8 }} />
                      <Text style={styles.quickCardText}>{q.text}</Text>
                    </GlassCard>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {messages.map((message) => (
              <View key={message.id} style={[styles.msgRow, message.isUser ? styles.msgRowUser : styles.msgRowAi]}>
                {!message.isUser && (
                  <View style={styles.aiAvatar}>
                    <LinearGradient colors={[APP_CONFIG.colors.primary, APP_CONFIG.colors.accent]} style={styles.avatarGradient}>
                      <Brain size={16} color="#FFF" />
                    </LinearGradient>
                  </View>
                )}
                <View style={[styles.bubbleContainer, message.isUser ? styles.userBubbleContainer : styles.aiBubbleContainer]}>
                  {message.isUser ? (
                    <LinearGradient
                      colors={[APP_CONFIG.colors.primary, APP_CONFIG.colors.accent]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.userGradientBubble}
                    >
                      <Text style={styles.userText}>{message.text}</Text>
                    </LinearGradient>
                  ) : (
                    <GlassCard style={styles.aiBubbleBlur}>
                      <View style={styles.aiBubbleContent}>
                        <Text style={styles.aiName}>{message.source === 'web' ? 'System • Web Search' : 'System • AI Model'}</Text>
                        {renderFormattedText(message.text)}
                        {message.searchResults && message.searchResults.map((res, idx) => (
                          <View key={idx} style={styles.citationCard}>
                            <Text style={styles.citationTitle} numberOfLines={1}>{res.title}</Text>
                            <Text style={styles.citationLink} numberOfLines={1}>{res.link}</Text>
                          </View>
                        ))}
                      </View>
                    </GlassCard>
                  )}
                </View>
              </View>
            ))}

            {isTyping && (
              <View style={styles.typingRow}>
                <View style={styles.aiAvatar}>
                  <LinearGradient colors={[APP_CONFIG.colors.primary, APP_CONFIG.colors.accent]} style={styles.avatarGradient}>
                    <Brain size={16} color="#FFF" />
                  </LinearGradient>
                </View>
                <GlassCard style={styles.typingBubble}>
                  <LottieView
                    source={require('../../assets/loading.json')} // Assuming you have a loading lottie, else simple dots
                    autoPlay loop
                    style={{ width: 40, height: 20 }}
                  />
                </GlassCard>
              </View>
            )}

          </ScrollView>

          {/* Input Area */}
          <GlassCard style={styles.inputArea}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Transmit query to mainframe..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
            />
            <TouchableOpacity onPress={handleSendMessage} style={styles.sendBtn} disabled={!inputText.trim()}>
              <LinearGradient
                colors={inputText.trim() ? [APP_CONFIG.colors.primary, APP_CONFIG.colors.accent] : [APP_CONFIG.colors.charcoal, APP_CONFIG.colors.darkNavy]}
                style={styles.sendGradient}
              >
                <Send size={20} color={inputText.trim() ? '#FFF' : '#888'} />
              </LinearGradient>
            </TouchableOpacity>
          </GlassCard>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ParticleBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    marginBottom: 10,
  },
  headerBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.border.default,
  },
  menuButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  modeToggleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleBlur: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 6,
  },
  activeToggle: {
    backgroundColor: APP_CONFIG.colors.accent,
  },
  toggleText: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#FFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingBottom: 24,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 10,
    gap: 12,
  },
  quickCard: {
    width: (width - 44) / 2,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickCardInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  quickCardText: {
    color: '#DDD',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowAi: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    marginRight: 12,
    marginBottom: 4,
  },
  avatarGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleContainer: {
    maxWidth: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  userBubbleContainer: {
    backgroundColor: 'transparent',
    borderBottomRightRadius: 4,
  },
  aiBubbleContainer: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  aiBubbleBlur: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  userGradientBubble: {
    padding: 14,
  },
  aiBubbleContent: {
    padding: 16,
  },
  userText: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 22,
  },
  aiName: {
    color: APP_CONFIG.colors.accent,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  aiText: {
    color: '#EEE',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 4,
  },
  bulletLine: {
    paddingLeft: 8,
  },
  boldText: {
    fontWeight: '700',
    color: '#FFF',
  },
  italicText: {
    fontStyle: 'italic',
    color: APP_CONFIG.colors.text.secondary,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: APP_CONFIG.colors.accent,
    fontSize: 13,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  typingBubble: {
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 24,
    color: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 10,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendBtn: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  sendGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  citationCard: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: APP_CONFIG.colors.info
  },
  citationTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold'
  },
  citationLink: {
    color: '#AAA',
    fontSize: 10
  }
});