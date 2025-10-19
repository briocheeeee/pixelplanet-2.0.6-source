# Avatar System Documentation

## Overview

The avatar system allows users to upload and display custom profile pictures throughout the application. Avatars are displayed in user profiles and chat messages, providing visual identity to users.

## Features

### Client-Side Features
- **Image Upload**: Users can upload images in multiple formats (JPEG, PNG, GIF, WebP, AVIF, HEIC/HEIF)
- **Client-Side Optimization**: Images are automatically resized to 256x256 and converted to WebP format before upload
- **Real-Time Preview**: Avatar updates are immediately reflected in the UI
- **Error Handling**: Clear error messages for upload failures, file size limits, and format issues
- **Loading States**: Visual feedback during upload process

### Server-Side Features
- **Image Processing**: Server-side processing using Sharp for optimal quality and performance
- **Security Validation**: Magic number validation to verify actual file types
- **Rate Limiting**: Multiple layers of rate limiting to prevent abuse
  - Per-user cooldown: 10 seconds between uploads
  - Per-IP limit: 5 uploads per 60 seconds
  - Concurrent upload prevention per user
- **File Size Limits**: Maximum 1MB upload size
- **Dimension Validation**: 
  - Minimum: 16x16 pixels
  - Maximum: 25 million pixels (prevents memory exhaustion)
- **Automatic Cleanup**: Old avatar files are automatically removed when new ones are uploaded

## Architecture

### Components

#### 1. AvatarUpload Component (`src/components/AvatarUpload.jsx`)
- Handles file selection and client-side optimization
- Converts images to WebP format (256x256, 85% quality)
- Manages upload state and error messages
- Dispatches Redux actions to update global state

#### 2. UserAreaContent Component (`src/components/UserAreaContent.jsx`)
- Displays user avatar in profile section
- Handles avatar loading errors with fallback
- Implements cache busting with version parameters

#### 3. ChatMessage Component (`src/components/ChatMessage.jsx`)
- Displays avatars in chat messages
- Supports fallback to user's own avatar for their messages
- Handles avatar path normalization
- Implements lazy loading for performance

#### 4. Avatar API Endpoint (`src/routes/api/avatar.js`)
- Processes uploaded avatar files
- Validates file format and dimensions
- Optimizes images using Sharp
- Updates database and broadcasts changes via WebSocket
- Implements comprehensive rate limiting

### Data Flow

1. **Upload Flow**:
   ```
   User selects image → Client-side WebP conversion → Upload to /api/avatar
   → Server validation → Sharp processing → Save to /public/avatars/
   → Update database → Broadcast via WebSocket → UI update
   ```

2. **Display Flow**:
   ```
   User data loaded → Avatar path in Redux state → Components render avatar
   → Cache busting with version parameter → Lazy loading in chat
   ```

### Storage

- **Location**: `dist/public/avatars/` (production) or `public/avatars/` (development)
- **Naming Convention**: `{userId}.webp`
- **Format**: WebP (256x256, quality 82, effort 4)
- **Database**: Avatar path stored in `Users.avatar` column as `/avatars/{userId}.webp`

### Security Measures

1. **Authentication**: Only authenticated users can upload avatars
2. **File Type Validation**: 
   - MIME type checking
   - Magic number validation (file signature verification)
3. **Rate Limiting**:
   - Per-user upload cooldown
   - Per-IP upload limits
   - Concurrent upload prevention
4. **File Size Limits**: 1MB maximum upload size
5. **Dimension Validation**: Prevents excessively large or small images
6. **Temporary File Cleanup**: Automatic cleanup of temp files

### Performance Optimizations

1. **Client-Side**:
   - WebP conversion before upload reduces bandwidth
   - Image resizing to 256x256 reduces file size
   - Lazy loading in chat messages
   - Cache busting prevents stale images

2. **Server-Side**:
   - Sharp library for fast image processing
   - WebP format for optimal compression
   - Automatic cleanup of old avatars
   - Efficient database queries

## API Reference

### POST /api/avatar

Upload a new avatar image.

**Authentication**: Required

**Request**:
- Content-Type: `multipart/form-data`
- Field: `avatar` (file)
- Accepted formats: JPEG, PNG, GIF, WebP, AVIF, HEIC/HEIF
- Maximum size: 1MB

**Response**:
```json
{
  "status": "ok",
  "avatar": "/avatars/123.webp",
  "version": 1697123456789,
  "message": "avatar updated successfully"
}
```

**Error Responses**:
- `401`: Not authorized
- `400`: Invalid file format or dimensions
- `413`: File too large
- `429`: Rate limit exceeded
- `500`: Server processing error
- `503`: Image processing unavailable

## Redux State Management

### Actions

- `s/SET_AVATAR`: Updates avatar in user state
- `s/LOGIN`: Sets avatar when user logs in
- `s/REC_ME`: Updates avatar from server response

### State Structure

```javascript
state.user.avatar = "/avatars/123.webp" | null
```

## Chat Integration

Avatars are integrated into the chat system:

1. **Message Storage**: Avatar paths are retrieved from the Users table when loading chat history
2. **Real-Time Messages**: Avatars are included in chat message broadcasts
3. **Display**: ChatMessage component renders avatars alongside messages
4. **Fallback**: If avatar fails to load, it's hidden gracefully

## Troubleshooting

### Avatar Not Displaying

1. Check that the avatar file exists in `/public/avatars/`
2. Verify the database has the correct path in `Users.avatar`
3. Check browser console for loading errors
4. Verify cache busting parameter is present

### Upload Failures

1. Check file size (must be < 1MB)
2. Verify file format is supported
3. Check rate limiting (wait 10 seconds between uploads)
4. Ensure Sharp module is installed on server
5. Check server logs for detailed error messages

### Performance Issues

1. Ensure WebP format is being used (check file extension)
2. Verify images are 256x256 (check file size)
3. Check that lazy loading is enabled in chat
4. Monitor server resources during uploads

## Future Enhancements

Potential improvements for the avatar system:

1. **Avatar Gallery**: Allow users to choose from preset avatars
2. **Crop Tool**: Client-side cropping before upload
3. **Animated Avatars**: Support for animated GIF/WebP
4. **Avatar Moderation**: Admin tools to review/remove avatars
5. **CDN Integration**: Serve avatars from CDN for better performance
6. **Multiple Sizes**: Generate multiple sizes for different use cases
7. **Avatar History**: Keep previous avatars for rollback

## Dependencies

- **Client**: React, Redux, ttag (translations)
- **Server**: Express, express-fileupload, Sharp, Sequelize
- **Database**: MySQL (Users table with avatar column)

## Maintenance

### Regular Tasks

1. Monitor avatar storage directory size
2. Review server logs for upload errors
3. Check rate limiting effectiveness
4. Verify Sharp module updates
5. Clean up orphaned avatar files (users who deleted accounts)

### Database Migrations

If modifying the avatar system, ensure:
1. Database schema changes are properly migrated
2. Existing avatar paths remain valid
3. Backward compatibility is maintained
