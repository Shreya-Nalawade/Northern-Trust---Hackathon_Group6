import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3001;

function bootstrap() {
  try {
    app.listen(PORT, () => {
      console.log('\n=============================================');
      console.log(`🚀 Payment Service is running on http://localhost:${PORT}`);
      console.log(`🔌 Health check endpoint: http://localhost:${PORT}/health`);
      console.log('=============================================\n');
    });
  } catch (error) {
    console.error('Fatal error during application bootstrap:', error);
    process.exit(1);
  }
}

bootstrap();
