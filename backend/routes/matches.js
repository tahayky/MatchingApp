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

    // ÖNEMLİ DEĞİŞİKLİK: Frontend profile ID gönderiyor, önce profili bul, sonra user'a eriş
    console.log(`[DEBUG] Searching for profile with ID: ${targetUserId}`);
    
    // Önce Profile modelinde arama yap (frontend'den gelen ID bir profile ID'si)
    const targetProfile = await Profile.findById(targetUserId);
    if (!targetProfile) {
      return res.status(404).json({
        success: false,
        message: 'Target profile not found'
      });
    }
    
    // Profil bulundu, şimdi bu profilin bağlı olduğu user'ı bul
    const profileUserId = targetProfile.user;
    console.log(`[DEBUG] Found profile, associated user ID: ${profileUserId}`);
    
    // Kontrol amaçlı user'ı da veritabanından kontrol et
    const targetUserExists = await User.findById(profileUserId);
    if (!targetUserExists) {
      return res.status(404).json({
        success: false,
        message: 'Target user associated with the profile not found'
      });
    }

    // ÖNEMLİ: Frontend'den gelen Profile ID'yi User ID'ye çevir
    // Bu kullanıcıdan hedefe yönelik mevcut bir eylem var mı diye bak
    let match = await Match.findOne({
      user: currentUserId,
      targetUser: profileUserId // Profile içindeki user ID'yi kullan!
    });

    // Mevcut kullanıcının profilini al (like işlemi için gerekli)
    let currentUserProfile = await Profile.findOne({ user: currentUserId });
    
    // Profil bulunamadıysa, findOneAndUpdate ile yeni profil oluştur
    // Bu yöntem ile eğer user id ile profil bulunursa onu günceller, yoksa yeni oluşturur
    if (!currentUserProfile) {
      console.log(`[DEBUG] Current user (${currentUserId}) does not have a profile, creating or updating in action endpoint`);
      
      try {
        currentUserProfile = await Profile.findOneAndUpdate(
          { user: currentUserId }, // Arama kriteri
          { 
            $setOnInsert: {
              user: currentUserId,
              location: {
                type: 'Point', // GeoJSON formatı için gerekli
                coordinates: [0, 0],
                city: 'Unknown',
                country: 'Unknown'
              },
              likedBy: [], // Başlangıçta boş likedBy listesi
              lastActive: new Date(),
              createdAt: new Date()
            }
          },
          { 
            new: true, // Güncellenen/oluşturulan belgeyi döndür
            upsert: true, // Belge yoksa oluştur
            setDefaultsOnInsert: true // Şema varsayılanlarını uygula
          }
        );
        
        console.log(`[DEBUG] Created or updated profile for user ${currentUserId} in action endpoint: ${currentUserProfile._id}`);
      } catch (profileError) {
        console.error('Error with profile in action endpoint:', profileError);
        return res.status(500).json({
          success: false,
          message: 'Error creating user profile'
        });
      }
    }

    let isNewAction = false;
    if (match) {
      // Mevcut kaydı güncelle (örneğin pass'tan like'a değişirse)
      if (match.action !== action) {
          match.action = action;
          // Eğer like'a çevriliyorsa, önceki eşleşme durumunu sıfırla (yeni kontrol edilecek)
          if (action === 'like') {
              match.isMatch = false;
              match.matchedAt = null;
              
              // Like durumunda hedef profilin likedBy dizisine ekle
              // Önce zaten eklenmiş mi diye kontrol et
              const alreadyLiked = targetProfile.likedBy.some(
                like => like.profile.toString() === currentUserProfile._id.toString()
              );
              
              if (!alreadyLiked) {
                targetProfile.likedBy.push({
                  profile: currentUserProfile._id,
                  likedAt: new Date()
                });
                await targetProfile.save();
                console.log(`[DEBUG] Added user ${currentUserId} to likedBy array of profile ${targetProfile._id}`);
              }
          }
          await match.save();
          console.log(`[DEBUG] Updated existing action for user ${currentUserId} to target user ${profileUserId} with action ${action}`);
      } else {
          console.log(`[DEBUG] Action already exists for user ${currentUserId} to target user ${profileUserId} with action ${action}. No change.`);
      }
    } else {
      // Yeni eylem oluştur - Burada TARGET USER olarak profileUserId kullan!
      match = new Match({
        user: currentUserId,
        targetUser: profileUserId, // Bu kritik değişiklik - profileUserId kullanılıyor!
        action
      });
      await match.save();
      isNewAction = true;
      
  // Eğer like ise, hedef profilin likedBy dizisine ekle
  if (action === 'like') {
    // Log the likedBy array before updating
    console.log(`[DEBUG] Current likedBy array for profile ${targetProfile._id} before update:`, JSON.stringify(targetProfile.likedBy || [], null, 2));
    
    // Check if liker is already in the likedBy array
    const alreadyLiked = targetProfile.likedBy && targetProfile.likedBy.some(
      like => like.profile && like.profile.toString() === currentUserProfile._id.toString()
    );
    
    if (!alreadyLiked) {
      targetProfile.likedBy.push({
        profile: currentUserProfile._id,
        likedAt: new Date()
      });
      
      // Save the updated profile
      const savedProfile = await targetProfile.save();
      console.log(`[DEBUG] Added profile ${currentUserProfile._id} to likedBy array of profile ${targetProfile._id}`);
      console.log(`[DEBUG] Updated likedBy array:`, JSON.stringify(savedProfile.likedBy || [], null, 2));
    } else {
      console.log(`[DEBUG] Profile ${currentUserProfile._id} already in likedBy array of profile ${targetProfile._id}`);
    }
  }
      
      console.log(`[DEBUG] Created new action for user ${currentUserId} to target user ${profileUserId} with action ${action}`);
    }

    let isMatch = false;
    // Eğer bu bir "like" eylemiyse, hedef kullanıcının da bu kullanıcıyı beğenip beğenmediğini kontrol et
    if (action === 'like') {
      // Karşı kullanıcının actionları içinde mevcut kullanıcıyı ara
      const reverseMatch = await Match.findOne({
        user: profileUserId, // Karşı tarafın User ID'si
        targetUser: currentUserId, // Mevcut kullanıcının ID'si
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

        console.log(`[DEBUG] Mutual match detected between user ${currentUserId} and user ${profileUserId}`);
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

// @route   GET /api/matches/likes
// @desc    Get all profiles that liked the current user (using new likedBy array)
// @access  Private
router.get('/likes', protect, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Mevcut kullanıcının profilini bul
    let currentUserProfile = await Profile.findOne({ user: currentUserId });
    
    // Profil bulunamadıysa, findOneAndUpdate ile yeni profil oluştur
    // Bu yöntem ile eğer user id ile profil bulunursa onu günceller, yoksa yeni oluşturur
    if (!currentUserProfile) {
      console.log(`[DEBUG] Current user (${currentUserId}) does not have a profile, creating or updating in likes endpoint`);
      
      try {
        currentUserProfile = await Profile.findOneAndUpdate(
          { user: currentUserId }, // Arama kriteri
          { 
            // Profil alanları
            $setOnInsert: {
              user: currentUserId,
              location: {
                type: 'Point', // GeoJSON formatı için gerekli
                coordinates: [0, 0],
                city: 'Unknown',
                country: 'Unknown'
              },
              likedBy: [], // Başlangıçta boş likedBy listesi
              lastActive: new Date(),
              createdAt: new Date()
            }
          },
          { 
            new: true, // Güncellenen/oluşturulan belgeyi döndür
            upsert: true, // Belge yoksa oluştur
            setDefaultsOnInsert: true // Şema varsayılanlarını uygula
          }
        );
        
        console.log(`[DEBUG] Created or updated profile for user ${currentUserId} in likes endpoint: ${currentUserProfile._id}`);
        
      } catch (profileError) {
        console.error('Error with profile in likes endpoint:', profileError);
        return res.status(500).json({
          success: false,
          message: 'Error creating user profile'
        });
      }
    }

    // Kullanıcının profilinde likedBy dizisi var mı kontrol et
    if (!currentUserProfile.likedBy || currentUserProfile.likedBy.length === 0) {
      // Boş beğeni listesi döndür
      return res.json({
        success: true,
        likes: []
      });
    }

    // likedBy dizisindeki profil ID'lerini topla
    const likerProfileIds = currentUserProfile.likedBy.map(like => like.profile);

    // Bu profilleri popüle et
    const likerProfiles = await Profile.find({
      _id: { $in: likerProfileIds }
    }).populate('user', 'name dateOfBirth');  // Kullanıcı temel bilgilerini al

    // Zaten eşleşmiş olan profilleri bul (bunları filtrelemek için)
    const existingMatches = await Match.find({
      user: currentUserId,
      action: 'like',
      isMatch: true,
      active: true
    }).select('targetUser');
    
    const matchedUserIds = existingMatches.map(match => match.targetUser.toString());

    // Sonuçları formatla ve eşleşenleri hariç tut
    const formattedLikes = likerProfiles
      .filter(profile => !matchedUserIds.includes(profile.user._id.toString())) // Zaten eşleşmiş olanları filtrele
      .map(profile => {
        // Kullanıcının bu profile ne zaman beğeni gönderdiğini bul
        const likeInfo = currentUserProfile.likedBy.find(
          like => like.profile.toString() === profile._id.toString()
        );
        
        // Ana fotoğrafı bul
        const mainPhoto = profile.photos?.find(p => p.isMain);
        
        // Yaş hesapla
        const birthDate = new Date(profile.user.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        return {
          userId: profile.user._id,
          profileId: profile._id,
          name: profile.user.name,
          age: age,
          bio: profile.bio || '',
          likedAt: likeInfo?.likedAt || new Date(),
          photo: mainPhoto?.url || null
        };
      })
      .sort((a, b) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime()); // En yeni beğeniler önce

    res.json({
      success: true,
      likes: formattedLikes
    });

  } catch (error) {
    console.error('Get likes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching likes',
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
