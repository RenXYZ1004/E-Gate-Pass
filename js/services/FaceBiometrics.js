// ════════════════════════════════════════════════════════════════
// FaceBiometrics — Client-side face recognition using face-api.js
// ════════════════════════════════════════════════════════════════
// Usage:
//   1. Call FaceBiometrics.init() once at app startup to load AI models.
//   2. Call FaceBiometrics.getDescriptor(imageElement) to extract a face map from a photo.
//   3. Call FaceBiometrics.matchFace(liveDescriptor, storedDescriptors) to find a match.
// ════════════════════════════════════════════════════════════════

const MODEL_URL = './js/lib/face-api-models';

// Match threshold: lower = stricter. 0.45 provides high accuracy and prevents false positives.
const MATCH_THRESHOLD = 0.45;

class FaceBiometrics {
  constructor() {
    this.modelsLoaded = false;
    this.loading = false;
  }

  /**
   * Load the face-api.js AI models into memory.
   * Call this once during app initialization.
   * @returns {Promise<boolean>} true if models loaded successfully
   */
  async init() {
    if (this.modelsLoaded) return true;
    if (this.loading) return false; // Prevent duplicate loads

    this.loading = true;
    try {
      // face-api.js is loaded as a global script in index.html
      if (typeof faceapi === 'undefined') {
        console.error('[FaceBiometrics] face-api.js library not found. Ensure the script tag is in index.html.');
        this.loading = false;
        return false;
      }

      console.log('[FaceBiometrics] Loading AI models...');

      // Load the three models we need:
      // 1. TinyFaceDetector — lightweight face detection (where is the face?)
      // 2. FaceLandmark68TinyNet — facial landmarks (eyes, nose, mouth positions)
      // 3. FaceRecognitionNet — face descriptor extraction (128-number identity vector)
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);

      this.modelsLoaded = true;
      this.loading = false;
      console.log('[FaceBiometrics] ✅ AI models loaded successfully.');
      return true;
    } catch (err) {
      console.error('[FaceBiometrics] ❌ Failed to load AI models:', err);
      this.loading = false;
      return false;
    }
  }

  /**
   * Extract a face descriptor (128-number identity vector) from an image or video element.
   * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} input — the source
   * @returns {Promise<Float32Array|null>} The 128-dimensional face descriptor, or null if no face found
   */
  async getDescriptor(input) {
    if (!this.modelsLoaded) {
      console.warn('[FaceBiometrics] Models not loaded yet. Call init() first.');
      return null;
    }

    try {
      const detection = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true) // true = use tiny model
        .withFaceDescriptor();

      if (!detection) {
        return null; // No face detected
      }

      return detection.descriptor;
    } catch (err) {
      console.error('[FaceBiometrics] Error extracting descriptor:', err);
      return null;
    }
  }

  /**
   * Detect a face and return the full detection result (with bounding box, landmarks, descriptor).
   * Used for drawing overlays on the video feed.
   * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} input
   * @returns {Promise<object|null>} Full detection result or null
   */
  async detectFace(input) {
    if (!this.modelsLoaded) return null;

    try {
      const detection = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      return detection || null;
    } catch (err) {
      console.error('[FaceBiometrics] Detection error:', err);
      return null;
    }
  }

  /**
   * Compare a live face descriptor against an array of stored descriptors.
   * @param {Float32Array} liveDescriptor — the face just captured from camera
   * @param {Array<{id: string, descriptor: Float32Array}>} storedDescriptors — the enrolled face maps
   * @returns {{match: boolean, studentId: string|null, distance: number}}
   */
  matchFace(liveDescriptor, storedDescriptors) {
    if (!liveDescriptor || !storedDescriptors || storedDescriptors.length === 0) {
      return { match: false, studentId: null, distance: 1 };
    }

    let bestMatch = { id: null, distance: 1 };

    for (const stored of storedDescriptors) {
      // Euclidean distance between two 128-dimensional vectors
      const distance = faceapi.euclideanDistance(liveDescriptor, stored.descriptor);
      if (distance < bestMatch.distance) {
        bestMatch = { id: stored.id, distance };
      }
    }

    return {
      match: bestMatch.distance < MATCH_THRESHOLD,
      studentId: bestMatch.id,
      distance: Math.round(bestMatch.distance * 100) / 100 // 2 decimal places
    };
  }

  /**
   * Convert a Float32Array descriptor to a plain JSON-serializable array.
   * Use this to save descriptors to localStorage or Google Sheets.
   * @param {Float32Array} descriptor
   * @returns {number[]}
   */
  descriptorToArray(descriptor) {
    return Array.from(descriptor);
  }

  /**
   * Convert a plain number array back to Float32Array.
   * Use this when loading descriptors from storage.
   * @param {number[]} arr
   * @returns {Float32Array}
   */
  arrayToDescriptor(arr) {
    return new Float32Array(arr);
  }

  /**
   * Get all enrolled face descriptors from localStorage.
   * @returns {Array<{id: string, descriptor: Float32Array}>}
   */
  getEnrolledFaces() {
    try {
      const raw = JSON.parse(localStorage.getItem('pgp_face_descriptors') || '[]');
      return raw.map(entry => ({
        id: entry.id,
        descriptor: this.arrayToDescriptor(entry.descriptor)
      }));
    } catch (err) {
      console.error('[FaceBiometrics] Error loading enrolled faces:', err);
      return [];
    }
  }

  /**
   * Save a new face descriptor to localStorage (enrollment).
   * @param {string} studentId — the student's pass ID or student ID
   * @param {Float32Array} descriptor — the 128-number face descriptor
   */
  enrollFace(studentId, descriptor) {
    const enrolled = JSON.parse(localStorage.getItem('pgp_face_descriptors') || '[]');
    
    // Remove existing entry for this student (re-enrollment)
    const filtered = enrolled.filter(e => e.id !== studentId);
    
    filtered.push({
      id: studentId,
      descriptor: this.descriptorToArray(descriptor)
    });

    localStorage.setItem('pgp_face_descriptors', JSON.stringify(filtered));
    console.log(`[FaceBiometrics] ✅ Enrolled face for student: ${studentId}`);
  }

  /**
   * Remove an enrolled face descriptor.
   * @param {string} studentId
   */
  unenrollFace(studentId) {
    const enrolled = JSON.parse(localStorage.getItem('pgp_face_descriptors') || '[]');
    const filtered = enrolled.filter(e => e.id !== studentId);
    localStorage.setItem('pgp_face_descriptors', JSON.stringify(filtered));
    console.log(`[FaceBiometrics] Removed face for student: ${studentId}`);
  }

  /**
   * Check how many faces are currently enrolled.
   * @returns {number}
   */
  getEnrolledCount() {
    try {
      return JSON.parse(localStorage.getItem('pgp_face_descriptors') || '[]').length;
    } catch {
      return 0;
    }
  }

  // ════════════════════════════════════════════════════════════
  // LIVENESS DETECTION — Anti-spoofing via blink check
  // Uses Eye Aspect Ratio (EAR) from 68-point facial landmarks
  // ════════════════════════════════════════════════════════════

  /**
   * Calculate the Eye Aspect Ratio (EAR) from facial landmarks.
   * When eyes are open, EAR ≈ 0.25-0.35. When closed (blink), EAR ≈ 0.05-0.15.
   * @param {object} landmarks — the faceLandmarks from detection
   * @returns {number} Average EAR of both eyes
   */
  getEyeAspectRatio(landmarks) {
    if (!landmarks) return 0.3;

    const positions = landmarks.positions;
    
    // 68-point landmark model eye indices:
    // Left eye:  points 36-41
    // Right eye: points 42-47
    const leftEye = positions.slice(36, 42);
    const rightEye = positions.slice(42, 48);

    const earLeft = this._calcEAR(leftEye);
    const earRight = this._calcEAR(rightEye);

    return (earLeft + earRight) / 2;
  }

  /**
   * Calculate EAR for a single eye using 6 landmark points.
   * EAR = (||p1-p5|| + ||p2-p4||) / (2 * ||p0-p3||)
   */
  _calcEAR(eyePoints) {
    const dist = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    
    // Vertical distances
    const v1 = dist(eyePoints[1], eyePoints[5]);
    const v2 = dist(eyePoints[2], eyePoints[4]);
    // Horizontal distance
    const h = dist(eyePoints[0], eyePoints[3]);
    
    if (h === 0) return 0.3;
    return (v1 + v2) / (2 * h);
  }

  /**
   * Check if the current EAR indicates a blink (eyes closed).
   * @param {number} ear — the current Eye Aspect Ratio
   * @returns {boolean} true if the person is blinking
   */
  isBlinking(ear) {
    return ear < 0.21; // Threshold: below 0.21 = eyes closed
  }

  // ════════════════════════════════════════════════════════════
  // SHEETS SYNC — Load descriptors from synced student data
  // ════════════════════════════════════════════════════════════

  /**
   * Load face descriptors from synced student records (from Google Sheets).
   * This supplements localStorage with cloud-synced descriptors.
   * @param {Array} students — the model.students array
   * @returns {Array<{id: string, descriptor: Float32Array}>}
   */
  getDescriptorsFromStudents(students) {
    const results = [];
    for (const s of students) {
      if (s.faceDescriptor) {
        try {
          const arr = typeof s.faceDescriptor === 'string' 
            ? JSON.parse(s.faceDescriptor) 
            : s.faceDescriptor;
          if (Array.isArray(arr) && arr.length === 128) {
            results.push({ id: s.id, descriptor: this.arrayToDescriptor(arr) });
          }
        } catch (err) {
          // Skip invalid descriptors silently
        }
      }
    }
    return results;
  }

  /**
   * Get ALL enrolled faces — merging localStorage AND synced students.
   * Synced students take priority (cloud source of truth).
   * @param {Array} students — optional model.students array
   * @returns {Array<{id: string, descriptor: Float32Array}>}
   */
  getAllEnrolledFaces(students = []) {
    const localFaces = this.getEnrolledFaces();
    const syncedFaces = this.getDescriptorsFromStudents(students);

    // Merge: synced overrides local for same student ID
    const merged = new Map();
    for (const f of localFaces) merged.set(f.id, f);
    for (const f of syncedFaces) merged.set(f.id, f); // Override with synced

    return Array.from(merged.values());
  }
}

// Export a singleton instance
const faceBiometrics = new FaceBiometrics();
export default faceBiometrics;
