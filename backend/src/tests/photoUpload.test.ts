import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../app';

describe('Photo Upload API', () => {
  let authToken: string = 'mock-jwt-token'; // Mock token for testing
  let userId: string;

  beforeAll(async () => {
    // Bu test için bir kullanıcı oluşturup token alın
    // Gerçek testlerde authentication setup yapılmalı
    // authToken = await getAuthTokenForTesting();
    // userId = await createTestUser();
  });

  describe('POST /api/users/profile/photos', () => {
    it('should upload a single photo successfully', async () => {
      const testImagePath = path.join(__dirname, '../../test-assets/test-image.jpg');
      
      // Test için basit bir image dosyası oluştur
      if (!fs.existsSync(path.dirname(testImagePath))) {
        fs.mkdirSync(path.dirname(testImagePath), { recursive: true });
      }

      const response = await request(app)
        .post('/api/users/profile/photos')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.photo).toHaveProperty('url');
      expect(response.body.photo).toHaveProperty('isMain');
    });

    it('should reject invalid file formats', async () => {
      const testTextPath = path.join(__dirname, '../../test-assets/test-file.txt');
      
      if (!fs.existsSync(path.dirname(testTextPath))) {
        fs.mkdirSync(path.dirname(testTextPath), { recursive: true });
      }
      fs.writeFileSync(testTextPath, 'This is not an image');

      const response = await request(app)
        .post('/api/users/profile/photos')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', testTextPath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject files that are too large', async () => {
      // Test for file size limit (>10MB)
      const response = await request(app)
        .post('/api/users/profile/photos')
        .set('Authorization', `Bearer ${authToken}`)
        .field('photo', 'large-file-content'.repeat(1024 * 1024)); // Mock large file

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/users/profile/photos/bulk', () => {
    it('should upload multiple photos successfully', async () => {
      const testImagePath1 = path.join(__dirname, '../../test-assets/test-image1.jpg');
      const testImagePath2 = path.join(__dirname, '../../test-assets/test-image2.jpg');

      const response = await request(app)
        .post('/api/users/profile/photos/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', testImagePath1)
        .attach('photos', testImagePath2);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.uploadedPhotos).toHaveLength(2);
    });

    it('should reject more than 6 photos', async () => {
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(request(app)
          .post('/api/users/profile/photos/bulk')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('photos', path.join(__dirname, `../../test-assets/test-image${i}.jpg`)));
      }

      // This should fail due to 6 photo limit
      const response = await request(app)
        .post('/api/users/profile/photos/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', path.join(__dirname, '../../test-assets/test-image1.jpg'))
        .attach('photos', path.join(__dirname, '../../test-assets/test-image2.jpg'))
        .attach('photos', path.join(__dirname, '../../test-assets/test-image3.jpg'))
        .attach('photos', path.join(__dirname, '../../test-assets/test-image4.jpg'))
        .attach('photos', path.join(__dirname, '../../test-assets/test-image5.jpg'))
        .attach('photos', path.join(__dirname, '../../test-assets/test-image6.jpg'))
        .attach('photos', path.join(__dirname, '../../test-assets/test-image7.jpg'));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/users/profile/photos/:photoId', () => {
    it('should delete a photo successfully', async () => {
      // First upload a photo
      const testImagePath = path.join(__dirname, '../../test-assets/test-image.jpg');
      
      const uploadResponse = await request(app)
        .post('/api/users/profile/photos')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', testImagePath);

      const photoId = uploadResponse.body.photo._id;

      // Then delete it
      const deleteResponse = await request(app)
        .delete(`/api/users/profile/photos/${photoId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
    });

    it('should return 404 for non-existent photo', async () => {
      const fakePhotoId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .delete(`/api/users/profile/photos/${fakePhotoId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/profile/photos/:photoId/main', () => {
    it('should set a photo as main successfully', async () => {
      // First upload a photo
      const testImagePath = path.join(__dirname, '../../test-assets/test-image.jpg');
      
      const uploadResponse = await request(app)
        .post('/api/users/profile/photos')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', testImagePath);

      const photoId = uploadResponse.body.photo._id;

      // Then set it as main
      const mainResponse = await request(app)
        .put(`/api/users/profile/photos/${photoId}/main`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(mainResponse.status).toBe(200);
      expect(mainResponse.body.success).toBe(true);
    });
  });
});