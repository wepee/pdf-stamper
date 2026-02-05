const VALID_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

/**
 * Validate payload schema
 * Returns error message string or null if valid
 */
export function validatePayload(payload) {
  // text.main is required
  if (!payload.text || typeof payload.text !== 'object') {
    return 'text object is required';
  }

  if (!payload.text.main || typeof payload.text.main !== 'string') {
    return 'text.main is required and must be a string';
  }

  if (payload.text.main.length > 1000) {
    return 'text.main must be 1000 characters or less';
  }

  // text.secondary is optional but must be string if present
  if (payload.text.secondary !== undefined && typeof payload.text.secondary !== 'string') {
    return 'text.secondary must be a string';
  }

  // pages validation
  if (payload.pages !== undefined) {
    if (payload.pages !== 'all' && !Array.isArray(payload.pages)) {
      return 'pages must be "all" or an array of page numbers';
    }
    if (Array.isArray(payload.pages)) {
      for (const p of payload.pages) {
        if (typeof p !== 'number' || !Number.isInteger(p) || p < 1) {
          return 'pages array must contain positive integers';
        }
      }
    }
  }

  // position validation
  if (payload.position !== undefined) {
    if (typeof payload.position !== 'object') {
      return 'position must be an object';
    }

    if (payload.position.anchor !== undefined) {
      if (!VALID_ANCHORS.includes(payload.position.anchor)) {
        return `position.anchor must be one of: ${VALID_ANCHORS.join(', ')}`;
      }
    }

    if (payload.position.marginX !== undefined) {
      if (typeof payload.position.marginX !== 'number') {
        return 'position.marginX must be a number';
      }
      if (payload.position.marginX < 0) {
        return 'position.marginX must be positive (margins are automatically applied based on anchor position)';
      }
    }

    if (payload.position.marginY !== undefined) {
      if (typeof payload.position.marginY !== 'number') {
        return 'position.marginY must be a number';
      }
      if (payload.position.marginY < 0) {
        return 'position.marginY must be positive (margins are automatically applied based on anchor position)';
      }
    }
  }

  // style validation
  if (payload.style !== undefined) {
    if (typeof payload.style !== 'object') {
      return 'style must be an object';
    }

    if (payload.style.fontSize !== undefined) {
      if (typeof payload.style.fontSize !== 'number' || payload.style.fontSize < 6 || payload.style.fontSize > 200) {
        return 'style.fontSize must be a number between 6 and 200';
      }
    }

    if (payload.style.opacity !== undefined) {
      if (typeof payload.style.opacity !== 'number' || payload.style.opacity < 0 || payload.style.opacity > 100) {
        return 'style.opacity must be a number between 0 and 100';
      }
    }

    if (payload.style.rotation !== undefined) {
      if (typeof payload.style.rotation !== 'number' || payload.style.rotation < -360 || payload.style.rotation > 360) {
        return 'style.rotation must be a number between -360 and 360';
      }
    }
  }

  return null; // Valid
}
