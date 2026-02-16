# WhatsApp Chat History System

## Overview

This system implements complete WhatsApp chat history functionality with pagination, allowing users to access historical messages beyond what's available in the real-time store.

## Features

### ✅ Enhanced Message Fetching
- Uses Baileys `fetchMessageHistory` with pagination support
- Multiple sync methods (chatModify, presence updates, loadMessages)
- Fallback to store when API fails
- Message processing and normalization

### ✅ Pagination Support
- Load messages in chunks (default 50, max 100)
- `beforeMessageId` parameter for backward pagination
- `hasMore` indicator for UI state management
- Scroll-to-top loading for infinite scroll

### ✅ Rich Message Support
- **Text messages** with search highlighting
- **Media messages** (images, videos, audio, documents) with previews
- **Location messages** with map integration
- **Contact messages** with vCard support
- **Stickers and other message types**

### ✅ Performance Optimizations
- Lazy loading of historical messages
- Media information only when requested
- Efficient message processing
- Caching to avoid repeated requests

## API Endpoints

### GET `/api/chats/:jid/messages`
**Purpose:** Get real-time messages from store (existing functionality)

**Parameters:**
- `limit` (optional): Number of messages (default 50, max 100)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "isGroup": false,
  "totalFound": 50,
  "source": "store"
}
```

### GET `/api/chats/:jid/history` ⭐ **NEW**
**Purpose:** Get complete chat history from WhatsApp with pagination

**Parameters:**
- `limit` (optional): Number of messages (default 50, max 100)
- `before` (optional): Message ID for pagination (load messages before this)
- `includeMedia` (optional): Include media URLs and metadata (default false)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "isGroup": false,
  "totalFound": 50,
  "hasMore": true,
  "source": "whatsapp_history",
  "pagination": {
    "limit": 50,
    "beforeMessageId": "msg_123",
    "canLoadMore": true
  }
}
```

## Enhanced Message Structure

```typescript
interface Message {
  // Basic fields
  id: string;
  from: string;
  body: string;
  type: MessageType;
  timestamp: number;
  fromMe: boolean;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'error';
  
  // Enhanced media information
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  
  // Location and contact info
  location?: {
    lat: number;
    lng: number;
    name?: string;
  };
  contactInfo?: {
    name: string;
    vcard: string;
  };
  
  // Metadata
  isMedia?: boolean;
  hasCaption?: boolean;
  participant?: string; // Group participant
}
```

## Frontend Integration

### ChatView Component Updates

1. **State Management:**
```typescript
const [isLoadingHistory, setIsLoadingHistory] = useState(false);
const [hasMoreHistory, setHasMoreHistory] = useState(true);
const [oldestLoadedMessageId, setOldestLoadedMessageId] = useState<string | null>(null);
```

2. **History Loading:**
```typescript
const loadHistory = useCallback(async (beforeMessageId?: string) => {
  if (!activeChat || isLoadingHistory || !hasMoreHistory) return;
  
  setIsLoadingHistory(true);
  
  try {
    const response = await chatApi.getChatHistory(
      activeChat, 
      50, 
      beforeMessageId,
      true // Include media
    );
    
    if (response.data.success) {
      const historyMessages = response.data.data || [];
      // Prepend to existing messages
      setMessages(activeChat, [...historyMessages, ...currentMessages]);
      setHasMoreHistory(response.data.hasMore);
    }
  } finally {
    setIsLoadingHistory(false);
  }
}, [activeChat, isLoadingHistory, hasMoreHistory]);
```

3. **Scroll-to-Top Loading:**
```typescript
const handleScroll = useCallback(() => {
  const container = messagesContainerRef.current;
  if (!container) return;
  
  const isAtTop = container.scrollTop < 100;
  
  if (isAtTop && hasMoreHistory && !isLoadingHistory) {
    loadHistory(oldestLoadedMessageId || undefined);
  }
}, [hasMoreHistory, isLoadingHistory, oldestLoadedMessageId, loadHistory]);
```

### MessageBubble Component Updates

1. **Media Previews:**
```typescript
const MediaPreview = () => {
  if (!message.mediaUrl || !message.isMedia) return null;
  
  switch (message.type) {
    case 'image':
      return <img src={message.mediaUrl} alt={message.body} />;
    case 'video':
      return <video src={message.mediaUrl} controls />;
    case 'audio':
      return <audio src={message.mediaUrl} controls />;
    case 'document':
      return <DocumentPreview message={message} />;
  }
};
```

2. **Location Preview:**
```typescript
const LocationPreview = () => {
  if (!message.location) return null;
  
  const mapsUrl = `https://maps.google.com/?q=${message.location.lat},${message.location.lng}`;
  
  return (
    <div>
      <MapPin />
      <a href={mapsUrl} target="_blank">View on map</a>
    </div>
  );
};
```

## Backend Implementation

### BotService Enhancements

1. **Enhanced fetchMessagesFromWA:**
```typescript
async fetchMessagesFromWA(
  jid: string, 
  count: number, 
  beforeMessageId?: string
): Promise<any[]> {
  // 1. Try Baileys fetchMessageHistory with pagination
  const messages = await this.bot.fetchMessageHistory(jid, count, beforeMessageId);
  
  // 2. Enhanced sync if no messages
  if (messages.length === 0) {
    const syncMessages = await this.enhancedMessageSync(jid, count);
    return syncMessages;
  }
  
  // 3. Process and normalize messages
  return this.processMessagesHistory(messages, jid);
}
```

2. **Message Processing:**
```typescript
private processMessagesHistory(messages: any[], jid: string): any[] {
  return messages
    .filter(msg => msg && msg.key && msg.message)
    .map(msg => ({
      id: msg.key?.id,
      from: msg.key?.remoteJid,
      fromMe: msg.key?.fromMe,
      body: this.extractMessageText(msg.message),
      type: this.extractMessageType(msg.message),
      mediaUrl: this.extractMediaUrl(msg.message),
      location: this.extractLocation(msg.message),
      // ... other fields
    }))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}
```

### BaileysClass Updates

1. **Pagination Support:**
```typescript
fetchMessageHistory = async (
  jid: string, 
  count: number = 50, 
  beforeMessageId?: string
): Promise<any[]> => {
  // Enhanced store access with pagination
  const getFromStore = () => {
    let messages = storeMessages.array;
    
    if (beforeMessageId) {
      const messageIndex = messages.findIndex(msg => msg.key?.id === beforeMessageId);
      if (messageIndex > 0) {
        const startIndex = Math.max(0, messageIndex - count);
        return messages.slice(startIndex, messageIndex);
      }
    }
    
    return messages.slice(-count);
  };
};
```

## Usage Examples

### Frontend: Loading Initial History
```typescript
// Load enhanced history on chat open
const response = await chatApi.getChatHistory(chatJid, 100, undefined, true);
if (response.data.success) {
  setMessages(chatJid, response.data.data);
  setHasMoreHistory(response.data.hasMore);
}
```

### Frontend: Loading More History
```typescript
// Load more history when user scrolls to top
const loadMore = async () => {
  const oldestMessage = messages[0];
  const response = await chatApi.getChatHistory(
    chatJid, 
    50, 
    oldestMessage.id, 
    true
  );
  
  if (response.data.success) {
    setMessages(chatJid, [...response.data.data, ...messages]);
  }
};
```

### Backend: Direct BotService Usage
```typescript
// Fetch history directly
const botService = BotService.getInstance();
const messages = await botService.fetchMessagesFromWA(jid, 50, beforeMessageId);

console.log(`Fetched ${messages.length} messages`);
console.log('Message types:', [...new Set(messages.map(m => m.type))]);
```

## Testing

### Test Script
Run the test script to verify functionality:

```bash
node test-chat-history.js
```

### Manual Testing Steps

1. **Basic History Loading:**
   - Open a chat with existing messages
   - Verify historical messages load automatically
   - Check console for "Loaded X messages from enhanced history"

2. **Pagination:**
   - Scroll to top of chat
   - Verify "Loading history..." indicator appears
   - Check that older messages load

3. **Media Messages:**
   - Find chats with images, videos, audio
   - Verify media previews render correctly
   - Test download functionality

4. **Location/Contact Messages:**
   - Find location messages
   - Verify map integration works
   - Test contact message display

## Performance Considerations

### ✅ Optimizations
- Lazy loading (only load history when needed)
- Chunked loading (50 messages at a time)
- Media URLs only when requested
- Efficient message processing
- Store fallback for offline access

### ⚠️ Limitations
- WhatsApp API rate limits
- Large chat loading times
- Media download bandwidth
- Memory usage for very long chats

### 📊 Monitoring
Add these metrics to monitor performance:
- History loading time
- Messages per request
- Media download time
- Error rates
- Memory usage

## Troubleshooting

### Common Issues

1. **No History Loading:**
   - Check WhatsApp connection status
   - Verify bot is initialized
   - Check console for sync errors

2. **Pagination Not Working:**
   - Verify `beforeMessageId` is valid
   - Check `hasMore` flag
   - Ensure oldest message ID is tracked

3. **Media Not Showing:**
   - Verify `includeMedia=true` parameter
   - Check media URL accessibility
   - Verify media processing in backend

4. **Performance Issues:**
   - Reduce `limit` parameter
   - Enable media loading only when needed
   - Check for memory leaks

### Debug Commands

```typescript
// Check BotService status
const botService = BotService.getInstance();
console.log('Bot ready:', !!botService.getBot());

// Test history fetching
const messages = await botService.fetchMessagesFromWA(jid, 10);
console.log('Messages:', messages.length);

// Check message processing
console.log('Message types:', [...new Set(messages.map(m => m.type))]);
```

## Future Enhancements

### 🚀 Planned Features
- [ ] Message search within history
- [ ] Export chat history
- [ ] Message threading/replies
- [ ] Message reactions
- [ ] Message deletion support
- [ ] Offline history caching

### 🔧 Technical Improvements
- [ ] WebSocket-based history updates
- [ ] IndexedDB for client-side caching
- [ ] Service Worker for offline access
- [ ] Message compression for large chats
- [ ] Progressive loading for media

---

**Implementation Status:** ✅ Complete
**Last Updated:** 2025-02-09
**Version:** 1.0.0