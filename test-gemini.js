const API_KEY = 'AIzaSyB8kEj7vyWPpt0k3Eh4rscaq-VQ6RKBhmk'; // Pega tu key aquí

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`)
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      console.log('❌ Error:', data.error.message);
      return;
    }
    const modelos = data.models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
    console.log('✅ Modelos disponibles para tu key:\n');
    modelos.forEach(m => console.log(' •', m));
  })
  .catch(e => console.log('Error de red:', e.message));
