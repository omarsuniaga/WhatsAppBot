
import { KnowledgeBaseService } from './src/server/services/knowledgeBaseService';

try {
    console.log('Testing KnowledgeBaseService...');
    const service = KnowledgeBaseService.getInstance();
    const stats = service.getStats();
    console.log('Success!', stats);
} catch (error) {
    console.error('Failed:', error);
}
