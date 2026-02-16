
const axios = require('axios');
const API_URL = 'http://localhost:3000/api';

async function runTest() {
    console.log('--- Iniciando Test de Integración ---');
    try {
        // 1. Crear un trigger de prueba
        console.log('1. Creando trigger "test_api"...');
        const triggerRes = await axios.post(`${API_URL}/triggers`, {
            keyword: 'test_api',
            matchType: 'contains',
            enabled: true,
            category: 'general',
            priority: 10
        });
        const triggerId = triggerRes.data.data.id;
        console.log('✅ Trigger creado ID:', triggerId);

        // 2. Crear una FAQ de prueba
        console.log('2. Creando FAQ "pregunta_test"...');
        const faqRes = await axios.post(`${API_URL}/knowledge/faqs`, {
            category: 'general',
            questions: ['pregunta_test'],
            answer: 'Respuesta real del sistema de prueba.',
            approved: true
        });
        const faqId = faqRes.data.data.id;
        console.log('✅ FAQ creada ID:', faqId);

        // 3. Probar el mensaje
        console.log('3. Probando mensaje: "Hola, activa el test_api con la pregunta_test"...');
        const testRes = await axios.post(`${API_URL}/triggers/test`, {
            message: 'Hola, activa el test_api con la pregunta_test'
        });

        const data = testRes.data.data;
        console.log('Resultados del Test:');
        console.log('- ¿Activaría el bot?:', data.wouldActivate);
        console.log('- Triggers detectados:', data.matchedTriggers.map(t => t.keyword));
        console.log('- Respuesta de IA sugerida:', data.aiAnalysis.response);

        // 4. Limpieza
        console.log('4. Limpiando datos de prueba...');
        await axios.delete(`${API_URL}/triggers/${triggerId}`);
        await axios.delete(`${API_URL}/knowledge/faqs/${faqId}`);
        console.log('✅ Limpieza completada.');

        if (data.wouldActivate && data.matchedTriggers.some(t => t.keyword === 'test_api') && data.aiAnalysis.response.includes('Respuesta real')) {
            console.log('\n🌟 ¡TEST EXITOSO! El sistema usa datos reales y persiste correctamente.');
        } else {
            console.log('\n❌ El test no devolvió los resultados esperados.');
        }

    } catch (error) {
        console.error('❌ Error durante el test:', error.response?.data || error.message);
    }
}

runTest();
