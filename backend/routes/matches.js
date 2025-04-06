const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // mongoose'u başta require et
const Match = require('../models/Match');
const Profile = require('../models/Profile');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST /api/matches/action
// @desc    Create like or pass action
// @access  Private
router.post('/action', protect, async (req, res) => {
  console.log(`--- SERVER HIT: POST /api/matches/action with body:`, req.body); // <--- ADD THIS LINE
  try {
    const { targetUserId, action } = req.body;
    const currentUserId = req.user._id; // Mevcut kullanıcı ID'si

    console.log(`[DEBUG] Received match action: ${action} from user: ${currentUserId} for targetUserId: ${targetUserId}`);

    // Gerekli alanları kontrol et
    if (!targetUserId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID and action are required'
      });
    }

    // Action türünü kontrol et
    if (action !== 'like' && action !== 'pass') {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "like" or "pass"'
      });
    }

    // Kendi kendine eylem kontrolü
    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot perform action on yourself'
      });
    }

    // TEST PROFİL ID KONTROLÜ - Eğer geçerli bir MongoDB ObjectID değilse, test ID'si olarak kabul et
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      console.log(`[DEBUG] Invalid ObjectID: ${targetUserId}, handling as test profile ID`);
      // Bu bir test profili ID'si, gerçek bir eşleşme oluşturmayız
      // Ancak başarılı bir yanıt döndürebiliriz (frontend'in akışını bozmamak için)
      return res.json({
        success: true,
        match: {
          targetUser: targetUserId,
          action,
          isMatch: false // Test ID'leri ile gerçek eşleşme olmaz
        }
      });
    }

    // Hedef kullanıcının veritabanında var olup olmadığını kontrol et
    const targetUserExists = await User.findById(targetUserId);
    if (!targetUserExists) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    // Bu kullanıcıdan hedefe yönelik mevcut bir eylem var mı diye bak
    let match = await Match.findOne({
      user: currentUserId,
      targetUser: targetUserId
    });

    let isNewAction = false;
    if (match) {
      // Mevcut kaydı güncelle (örneğin pass'tan like'a değişirse)
      if (match.action !== action) {
          match.action = action;
          // Eğer like'a çevriliyorsa, önceki eşleşme durumunu sıfırla (yeni kontrol edilecek)
          if (action === 'like') {
              match.isMatch = false;
              match.matchedAt = null;
          }
          await match.save();
          console.log(`[DEBUG] Updated existing action for user ${currentUserId} to target ${targetUserId} with action ${action}`);
      } else {
          console.log(`[DEBUG] Action already exists for user ${currentUserId} to target ${targetUserId} with action ${action}. No change.`);
      }
    } else {
      // Yeni eylem oluştur
      match = new Match({
        user: currentUserId,
        targetUser: targetUserId,
        action
      });
      await match.save();
      isNewAction = true;
      console.log(`[DEBUG] Created new action for user ${currentUserId} to target ${targetUserId} with action ${action}`);
    }

    let isMatch = false;
    // Eğer bu bir "like" eylemiyse, hedef kullanıcının da bu kullanıcıyı beğenip beğenmediğini kontrol et
    if (action === 'like') {
      const reverseMatch = await Match.findOne({
        user: targetUserId,
        targetUser: currentUserId,
        action: 'like'
      });

      if (reverseMatch) {
        // Eşleşme! Her iki kaydı da güncelle
        isMatch = true;
        const matchTimestamp = new Date();

        // Mevcut kullanıcının eylemini güncelle (zaten yukarıda save edildi veya yeni oluşturuldu)
        match.isMatch = true;
        match.matchedAt = matchTimestamp;
        match.active = true; // Eşleşme olduğunda aktif et
        await match.save();

        // Hedef kullanıcının eylemini güncelle
        reverseMatch.isMatch = true;
        reverseMatch.matchedAt = matchTimestamp;
        reverseMatch.active = true; // Eşleşme olduğunda aktif et
        await reverseMatch.save();

        console.log(`[DEBUG] Mutual match detected between ${currentUserId} and ${targetUserId}`);
      }
    }

    res.json({
      success: true,
      match: {
        targetUser: targetUserId,
        action,
        isMatch
      }
    });

  } catch (error) {
    console.error('Match action error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during match action',
      error: error.message
    });
  }
});

// --- İkinci (hatalı) /action route'u kaldırıldı ---

// @route   GET /api/matches
// @desc    Get all active mutual matches for the current user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Mevcut kullanıcı için aktif ve karşılıklı olan tüm eşleşmeleri bul
    const matches = await Match.find({
      user: currentUserId,
      isMatch: true,
      active: true // Sadece aktif eşleşmeleri getir
    }).populate({
      path: 'targetUser', // Eşleşilen kullanıcının bilgisini al
      select: 'name _id' // Sadece isim ve ID'yi seç
    }).sort({ matchedAt: -1 }); // En yeni eşleşmeler önce gelsin

    // Eşleşen kullanıcıların ID'lerini topla
    const targetUserIds = matches.map(match => match.targetUser._id);

    // İlgili profilleri tek bir sorguda çek (Performans için)
    const profiles = await Profile.find({
      user: { $in: targetUserIds }
    }).select('user photos lastActive'); // Gerekli alanları seç

    // Profil bilgilerini kolay erişim için bir haritaya dönüştür
    const profileMap = new Map();
    profiles.forEach(profile => {
      profileMap.set(profile.user.toString(), profile);
    });

    // Sonuçları formatla
    const matchesWithProfiles = matches.map(match => {
      const profile = profileMap.get(match.targetUser._id.toString());
      const mainPhoto = profile?.photos?.find(p => p.isMain);

      return {
        matchId: match._id,
        userId: match.targetUser._id,
        name: match.targetUser.name,
        matchedAt: match.matchedAt,
        // Profil veya ana fotoğraf bulunamazsa null döndür
        photoUrl: mainPhoto?.url || null,
        lastActive: profile?.lastActive || null
      };
    });

    res.json({
      success: true,
      matches: matchesWithProfiles
    });

  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching matches',
      error: error.message
    });
  }
});

// @route   DELETE /api/matches/:matchId
// @desc    Unmatch with a user (marks the match as inactive)
// @access  Private
router.delete('/:matchId', protect, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { matchId } = req.params;

    // matchId geçerli mi kontrol et
    if (!mongoose.Types.ObjectId.isValid(matchId)) {
        return res.status(400).json({ success: false, message: 'Invalid Match ID format' });
    }

    // Eşleşmeyi bul
    const match = await Match.findById(matchId);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Bu eşleşmenin mevcut kullanıcıya ait olup olmadığını kontrol et
    // VE eşleşmenin gerçekten bir eşleşme (isMatch: true) olduğunu kontrol et
    if (match.user.toString() !== currentUserId.toString() || !match.isMatch) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to unmatch this connection or it is not a valid match'
      });
    }

    // Eşleşmeyi pasif yap
    match.active = false;
    await match.save();
    console.log(`[DEBUG] Deactivated match ${matchId} for user ${currentUserId}`);


    // Karşı tarafın eşleşme kaydını da bul ve pasif yap
    const reverseMatch = await Match.findOneAndUpdate(
      {
        user: match.targetUser, // Karşı tarafın user alanı
        targetUser: currentUserId, // Karşı tarafın targetUser alanı (yani biz)
        isMatch: true // Sadece gerçek eşleşmeleri hedefle
      },
      { active: false }, // Pasif yap
      { new: true } // Güncellenmiş belgeyi döndürmeye gerek yok ama seçenek olarak var
    );

    if (reverseMatch) {
        console.log(`[DEBUG] Deactivated reverse match ${reverseMatch._id} for user ${match.targetUser}`);
    } else {
        console.log(`[DEBUG] Could not find or update reverse match for user ${match.targetUser} targeting ${currentUserId}. It might already be inactive or deleted.`);
    }


    res.json({
      success: true,
      message: 'Successfully unmatched'
    });

  } catch (error) {
    console.error('Unmatch error:', error);
    // ObjectId cast hatası olup olmadığını kontrol et
     if (error instanceof mongoose.Error.CastError) {
        return res.status(400).json({ success: false, message: 'Invalid Match ID format provided' });
     }
    res.status(500).json({
      success: false,
      message: 'Server error during unmatch',
      error: error.message
    });
  }
});

module.exports = router;