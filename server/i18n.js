const LANGUAGES = ["en", "fr", "ar"];

const MESSAGES = {
  "Choose one of the showroom cars.": { fr: "Choisissez l'une des voitures du showroom.", ar: "اختر إحدى سيارات صالة العرض." },
  "Enter your full name (2 to 80 characters).": {
    fr: "Saisissez votre nom complet (2 à 80 caractères).",
    ar: "أدخل اسمك الكامل (من 2 إلى 80 حرفًا).",
  },
  "Choose your wilaya.": { fr: "Choisissez votre wilaya.", ar: "اختر ولايتك." },
  "Your message must be 1000 characters or fewer.": {
    fr: "Votre message ne doit pas dépasser 1000 caractères.",
    ar: "يجب ألا تتجاوز رسالتك 1000 حرف.",
  },
  "The car configuration is not valid.": { fr: "La configuration de la voiture n'est pas valide.", ar: "إعدادات السيارة غير صالحة." },
  "The price of the configuration does not add up. Reload the page and try again.": {
    fr: "Le prix de la configuration ne correspond pas. Rechargez la page et réessayez.",
    ar: "سعر الإعدادات غير متطابق. أعد تحميل الصفحة وحاول مرة أخرى.",
  },
  "Too many requests. Try again in a few minutes.": {
    fr: "Trop de demandes. Réessayez dans quelques minutes.",
    ar: "طلبات كثيرة جدًا. حاول مرة أخرى بعد بضع دقائق.",
  },
  "Please complete all required fields.": { fr: "Veuillez remplir tous les champs obligatoires.", ar: "يرجى ملء جميع الحقول المطلوبة." },
  "Please enter a valid phone number.": { fr: "Veuillez saisir un numéro de téléphone valide.", ar: "يرجى إدخال رقم هاتف صالح." },
  "Enter a valid email address.": { fr: "Saisissez une adresse e-mail valide.", ar: "أدخل عنوان بريد إلكتروني صالحًا." },
  "Enter the vehicle make.": { fr: "Indiquez la marque du véhicule.", ar: "أدخل العلامة التجارية للمركبة." },
  "Enter the vehicle model.": { fr: "Indiquez le modèle du véhicule.", ar: "أدخل طراز المركبة." },
  "Enter a valid year.": { fr: "Saisissez une année valide.", ar: "أدخل سنة صالحة." },
  "Enter a valid mileage.": { fr: "Saisissez un kilométrage valide.", ar: "أدخل عدد كيلومترات صالحًا." },
  "Keep the engine field short.": { fr: "Le champ moteur doit être court.", ar: "اجعل حقل المحرك قصيرًا." },
  "Keep the registration short.": { fr: "L'immatriculation doit être courte.", ar: "اجعل رقم التسجيل قصيرًا." },
  "Keep the vehicle notes to 1000 characters or fewer.": {
    fr: "Les notes sur le véhicule ne doivent pas dépasser 1000 caractères.",
    ar: "يجب ألا تتجاوز ملاحظات المركبة 1000 حرف.",
  },
  "Report at least one problem.": { fr: "Signalez au moins un problème.", ar: "أبلغ عن مشكلة واحدة على الأقل." },
  "Choose a problem area for each item.": { fr: "Choisissez une zone de problème pour chaque élément.", ar: "اختر منطقة المشكلة لكل عنصر." },
  "Describe each problem (up to 1000 characters).": {
    fr: "Décrivez chaque problème (jusqu'à 1000 caractères).",
    ar: "صِف كل مشكلة (حتى 1000 حرف).",
  },
  "The selected area is not valid.": { fr: "La zone sélectionnée n'est pas valide.", ar: "المنطقة المحددة غير صالحة." },
  "Choose how urgent each problem is.": { fr: "Indiquez l'urgence de chaque problème.", ar: "حدد مدى إلحاح كل مشكلة." },
  "Keep each description to 1000 characters or fewer.": {
    fr: "Chaque description ne doit pas dépasser 1000 caractères.",
    ar: "يجب ألا يتجاوز كل وصف 1000 حرف.",
  },
  "Keep the timing note short.": { fr: "La note sur la date doit être courte.", ar: "اجعل ملاحظة التوقيت قصيرة." },
  "Keep each note to 1000 characters or fewer.": {
    fr: "Chaque note ne doit pas dépasser 1000 caractères.",
    ar: "يجب ألا تتجاوز كل ملاحظة 1000 حرف.",
  },
  "Choose how we should contact you.": { fr: "Choisissez comment nous devons vous contacter.", ar: "اختر كيف يجب أن نتواصل معك." },
  "Choose a valid date.": { fr: "Choisissez une date valide.", ar: "اختر تاريخًا صالحًا." },
  "The preferred date cannot be in the past.": {
    fr: "La date souhaitée ne peut pas être dans le passé.",
    ar: "لا يمكن أن يكون التاريخ المفضّل في الماضي.",
  },
  "Choose a valid time.": { fr: "Choisissez une heure valide.", ar: "اختر وقتًا صالحًا." },
  "Keep your comments to 1000 characters or fewer.": {
    fr: "Vos commentaires ne doivent pas dépasser 1000 caractères.",
    ar: "يجب ألا تتجاوز تعليقاتك 1000 حرف.",
  },
  "Your repair request has been sent. Our team will review it and get back to you.": {
    fr: "Votre demande de réparation a été envoyée. Notre équipe va l'étudier et vous recontacter.",
    ar: "تم إرسال طلب الإصلاح. سيراجعه فريقنا ويعاود الاتصال بك.",
  },
  "Could not save your repair request.": { fr: "Impossible d'enregistrer votre demande de réparation.", ar: "تعذّر حفظ طلب الإصلاح." },
  "Please enter a valid request number and phone number.": {
    fr: "Veuillez saisir un numéro de demande et un numéro de téléphone valides.",
    ar: "يرجى إدخال رقم طلب ورقم هاتف صالحين.",
  },
  "Repair request not found.": { fr: "Demande de réparation introuvable.", ar: "طلب الإصلاح غير موجود." },
  "Your request has been sent. Our team will review it.": {
    fr: "Votre demande a été envoyée. Notre équipe va l'étudier.",
    ar: "تم إرسال طلبك. سيراجعه فريقنا.",
  },
  "Could not save your request.": { fr: "Impossible d'enregistrer votre demande.", ar: "تعذّر حفظ طلبك." },
  "Could not retrieve the request status.": { fr: "Impossible de récupérer l'état de la demande.", ar: "تعذّر جلب حالة الطلب." },
  "Car request not found.": { fr: "Demande de voiture introuvable.", ar: "طلب السيارة غير موجود." },
  "Invalid car request ID.": { fr: "Identifiant de demande non valide.", ar: "معرّف الطلب غير صالح." },
  "Choose approve or reject.": { fr: "Choisissez d'accepter ou de refuser.", ar: "اختر القبول أو الرفض." },
  "The note must be 500 characters or fewer.": {
    fr: "La note ne doit pas dépasser 500 caractères.",
    ar: "يجب ألا تتجاوز الملاحظة 500 حرف.",
  },
  "This request has already been reviewed.": { fr: "Cette demande a déjà été traitée.", ar: "تمت مراجعة هذا الطلب بالفعل." },
  "Request approved.": { fr: "Demande acceptée.", ar: "تم قبول الطلب." },
  "Request rejected.": { fr: "Demande refusée.", ar: "تم رفض الطلب." },
  "Access denied. Please login as admin.": {
    fr: "Accès refusé. Connectez-vous en tant qu'administrateur.",
    ar: "تم رفض الوصول. سجّل الدخول بصفتك مسؤولًا.",
  },
  "Admin access required.": { fr: "Accès administrateur requis.", ar: "يلزم الدخول بصفة مسؤول." },
  "Invalid or expired token.": { fr: "Session non valide ou expirée.", ar: "الجلسة غير صالحة أو منتهية الصلاحية." },
  "Welcome to AutoZone API": { fr: "Bienvenue sur l'API AutoZone", ar: "مرحبًا بك في واجهة AutoZone البرمجية" },
  "Only JPG, PNG and WEBP images are allowed.": {
    fr: "Seules les images JPG, PNG et WEBP sont acceptées.",
    ar: "لا تُقبل إلا صور JPG وPNG وWEBP.",
  },
  "Each image must be 5 MB or smaller.": {
    fr: "Chaque image doit faire 5 Mo au maximum.",
    ar: "يجب ألا يتجاوز حجم كل صورة 5 ميغابايت.",
  },
  "You can upload a maximum of 9 images.": {
    fr: "Vous pouvez envoyer 9 images au maximum.",
    ar: "يمكنك رفع 9 صور كحدّ أقصى.",
  },
  "Unexpected image field or too many images.": {
    fr: "Champ d'image inattendu ou trop d'images.",
    ar: "حقل صورة غير متوقع أو عدد الصور كبير جدًا.",
  },
  "Choose a valid category.": { fr: "Choisissez une catégorie valide.", ar: "اختر فئة صالحة." },
  "Choose a category.": { fr: "Choisissez une catégorie.", ar: "اختر فئة." },
  "Unknown category.": { fr: "Catégorie inconnue.", ar: "فئة غير معروفة." },
  "Unknown brand.": { fr: "Marque inconnue.", ar: "علامة غير معروفة." },
  "Unknown sort order.": { fr: "Ordre de tri inconnu.", ar: "ترتيب فرز غير معروف." },
  "Condition must be New or Used.": {
    fr: "L'état doit être « New » ou « Used ».",
    ar: "يجب أن تكون الحالة New أو Used.",
  },
  "Featured must be true or false.": {
    fr: "Le paramètre « featured » doit valoir true ou false.",
    ar: "يجب أن تكون قيمة featured إما true أو false.",
  },
  "Page size must be 8 or less in a batch.": {
    fr: "La taille de page ne doit pas dépasser 8 dans un lot.",
    ar: "يجب ألا يتجاوز حجم الصفحة 8 في الدفعة الواحدة.",
  },
  "Could not retrieve listings.": { fr: "Impossible de récupérer les annonces.", ar: "تعذّر جلب الإعلانات." },
  "Failed to retrieve listings.": { fr: "Impossible de récupérer les annonces.", ar: "تعذّر جلب الإعلانات." },
  "Failed to check saved listings.": {
    fr: "Impossible de vérifier les annonces enregistrées.",
    ar: "تعذّر التحقق من الإعلانات المحفوظة.",
  },
  "Failed to retrieve the overview.": {
    fr: "Impossible de récupérer la vue d'ensemble.",
    ar: "تعذّر جلب النظرة العامة.",
  },
  "Failed to retrieve car details.": {
    fr: "Impossible de récupérer les détails de l'annonce.",
    ar: "تعذّر جلب تفاصيل الإعلان.",
  },
  "Invalid car ID.": { fr: "Identifiant d'annonce non valide.", ar: "معرّف الإعلان غير صالح." },
  "Listing not found.": { fr: "Annonce introuvable.", ar: "الإعلان غير موجود." },
  "A cover photo is required.": { fr: "Une photo principale est obligatoire.", ar: "صورة الغلاف مطلوبة." },
  "Invalid seller or car information.": {
    fr: "Informations du vendeur ou du véhicule non valides.",
    ar: "معلومات البائع أو المركبة غير صالحة.",
  },
  "Seller and car information are required.": {
    fr: "Les informations du vendeur et du véhicule sont obligatoires.",
    ar: "معلومات البائع والمركبة مطلوبة.",
  },
  "Please enter a valid email address.": {
    fr: "Saisissez une adresse e-mail valide.",
    ar: "يُرجى إدخال بريد إلكتروني صالح.",
  },
  "Please enter valid vehicle information.": {
    fr: "Saisissez des informations valides sur le véhicule.",
    ar: "يُرجى إدخال معلومات صالحة عن المركبة.",
  },
  "Invalid vehicle options.": { fr: "Options du véhicule non valides.", ar: "خيارات المركبة غير صالحة." },
  "Your listing has been submitted for review.": {
    fr: "Votre annonce a été envoyée pour validation.",
    ar: "أُرسل إعلانك للمراجعة.",
  },
  "Something went wrong while saving your listing.": {
    fr: "Une erreur est survenue lors de l'enregistrement de votre annonce.",
    ar: "حدث خطأ أثناء حفظ إعلانك.",
  },
  "Invalid preferred date.": { fr: "Date souhaitée non valide.", ar: "التاريخ المفضّل غير صالح." },
  "This listing is not available.": { fr: "Cette annonce n'est pas disponible.", ar: "هذا الإعلان غير متاح." },
  "Your inspection request has been submitted successfully.": {
    fr: "Votre demande d'inspection a bien été envoyée.",
    ar: "تم إرسال طلب المعاينة بنجاح.",
  },
  "Could not save your inspection request.": {
    fr: "Impossible d'enregistrer votre demande d'inspection.",
    ar: "تعذّر حفظ طلب المعاينة.",
  },
  "Please enter a valid request ID and phone number.": {
    fr: "Saisissez un numéro de demande et un numéro de téléphone valides.",
    ar: "يُرجى إدخال رقم طلب ورقم هاتف صالحين.",
  },
  "No request found with these details.": {
    fr: "Aucune demande ne correspond à ces informations.",
    ar: "لا يوجد طلب مطابق لهذه المعلومات.",
  },
  "Could not retrieve inspection status.": {
    fr: "Impossible de récupérer le statut de l'inspection.",
    ar: "تعذّر جلب حالة المعاينة.",
  },
  "Too many failed attempts. Try again in 15 minutes.": {
    fr: "Trop de tentatives échouées. Réessayez dans 15 minutes.",
    ar: "محاولات فاشلة كثيرة. أعد المحاولة بعد 15 دقيقة.",
  },
  "Login configuration or password is missing.": {
    fr: "La configuration de connexion ou le mot de passe est manquant.",
    ar: "إعدادات تسجيل الدخول أو كلمة المرور غير متوفرة.",
  },
  "Incorrect password.": { fr: "Mot de passe incorrect.", ar: "كلمة المرور غير صحيحة." },
  "Admin login successful.": { fr: "Connexion administrateur réussie.", ar: "تم تسجيل دخول المسؤول بنجاح." },
  "Login failed.": { fr: "Échec de la connexion.", ar: "فشل تسجيل الدخول." },
  "Invalid listing status.": { fr: "Statut d'annonce non valide.", ar: "حالة الإعلان غير صالحة." },
  "Could not retrieve inspection requests.": {
    fr: "Impossible de récupérer les demandes d'inspection.",
    ar: "تعذّر جلب طلبات المعاينة.",
  },
  "Invalid inspection request ID.": {
    fr: "Identifiant de demande d'inspection non valide.",
    ar: "معرّف طلب المعاينة غير صالح.",
  },
  "Please complete all required appointment details.": {
    fr: "Renseignez toutes les informations obligatoires du rendez-vous.",
    ar: "يُرجى إكمال جميع معلومات الموعد المطلوبة.",
  },
  "Invalid appointment date.": { fr: "Date de rendez-vous non valide.", ar: "تاريخ الموعد غير صالح." },
  "Invalid appointment time.": { fr: "Heure de rendez-vous non valide.", ar: "وقت الموعد غير صالح." },
  "Pending inspection request not found.": {
    fr: "Demande d'inspection en attente introuvable.",
    ar: "طلب المعاينة قيد الانتظار غير موجود.",
  },
  "Inspection appointment scheduled successfully.": {
    fr: "Le rendez-vous d'inspection a bien été planifié.",
    ar: "تمت برمجة موعد المعاينة بنجاح.",
  },
  "Could not schedule the inspection.": { fr: "Impossible de planifier l'inspection.", ar: "تعذّرت برمجة المعاينة." },
  "Invalid inspection status.": { fr: "Statut d'inspection non valide.", ar: "حالة المعاينة غير صالحة." },
  "Inspection request not found.": { fr: "Demande d'inspection introuvable.", ar: "طلب المعاينة غير موجود." },
  "Inspection request status updated successfully.": {
    fr: "Le statut de la demande d'inspection a bien été mis à jour.",
    ar: "تم تحديث حالة طلب المعاينة بنجاح.",
  },
  "Could not update inspection request status.": {
    fr: "Impossible de mettre à jour le statut de la demande d'inspection.",
    ar: "تعذّر تحديث حالة طلب المعاينة.",
  },
  "Could not retrieve dashboard statistics.": {
    fr: "Impossible de récupérer les statistiques du tableau de bord.",
    ar: "تعذّر جلب إحصاءات لوحة التحكم.",
  },
  "Only live listings can be featured.": {
    fr: "Seules les annonces en ligne peuvent être mises en avant.",
    ar: "لا يمكن إبراز إلا الإعلانات المنشورة.",
  },
  "Could not update listing.": { fr: "Impossible de mettre à jour l'annonce.", ar: "تعذّر تحديث الإعلان." },
  "Invalid action.": { fr: "Action non valide.", ar: "إجراء غير صالح." },
  "Listing not found or already updated.": {
    fr: "Annonce introuvable ou déjà mise à jour.",
    ar: "الإعلان غير موجود أو سبق تحديثه.",
  },
  "Incorrect email or password.": { fr: "E-mail ou mot de passe incorrect.", ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة." },
  "Only the owner can do this.": { fr: "Seul le propriétaire peut effectuer cette action.", ar: "هذا الإجراء مخصّص للمالك فقط." },
  "Your listing is now live.": { fr: "Votre annonce est en ligne.", ar: "إعلانك منشور الآن." },
  "Inspection requests are paused for now.": { fr: "Les demandes d'inspection sont suspendues pour le moment.", ar: "طلبات الفحص متوقفة مؤقتًا." },
  "The contact form is closed for now.": { fr: "Le formulaire de contact est fermé pour le moment.", ar: "نموذج الاتصال مغلق حاليًا." },
  "Your message has been sent.": { fr: "Votre message a bien été envoyé.", ar: "تم إرسال رسالتك." },
  "Too many messages. Try again in a few minutes.": { fr: "Trop de messages. Réessayez dans quelques minutes.", ar: "رسائل كثيرة جدًا. أعد المحاولة بعد بضع دقائق." },
  "Enter your name.": { fr: "Indiquez votre nom.", ar: "أدخل اسمك." },
  "Give an email address or a phone number so we can answer you.": { fr: "Indiquez un e-mail ou un numéro de téléphone pour que nous puissions vous répondre.", ar: "أدخل بريدًا إلكترونيًا أو رقم هاتف حتى نتمكن من الرد عليك." },
  "Enter a valid phone number.": { fr: "Saisissez un numéro de téléphone valide.", ar: "أدخل رقم هاتف صالحًا." },
  "Choose a subject.": { fr: "Choisissez un sujet.", ar: "اختر موضوع الرسالة." },
  "Your message must be between 10 and 2000 characters.": { fr: "Votre message doit contenir entre 10 et 2000 caractères.", ar: "يجب أن تتراوح رسالتك بين 10 و2000 حرف." },
  "Your current password is not correct.": { fr: "Votre mot de passe actuel est incorrect.", ar: "كلمة المرور الحالية غير صحيحة." },
  "The new password must have at least 10 characters.": { fr: "Le nouveau mot de passe doit contenir au moins 10 caractères.", ar: "يجب أن تتكون كلمة المرور الجديدة من 10 أحرف على الأقل." },
  "This email is already used by another account.": { fr: "Cet e-mail est déjà utilisé par un autre compte.", ar: "هذا البريد الإلكتروني مستخدم في حساب آخر." },
  "Your account has been updated.": { fr: "Votre compte a été mis à jour.", ar: "تم تحديث حسابك." },
  "Message not found.": { fr: "Message introuvable.", ar: "الرسالة غير موجودة." },
  "Invalid message status.": { fr: "Statut de message non valide.", ar: "حالة الرسالة غير صالحة." },
  "Enter the vehicle name.": { fr: "Indiquez le nom du véhicule.", ar: "أدخل اسم المركبة." },
  "Enter a valid price.": { fr: "Saisissez un prix valide.", ar: "أدخل سعرًا صالحًا." },
  "Choose a wilaya.": { fr: "Choisissez une wilaya.", ar: "اختر الولاية." },
  "Listing saved.": { fr: "Annonce enregistrée.", ar: "تم حفظ الإعلان." },
  "Choose listings and an action.": { fr: "Choisissez des annonces et une action.", ar: "اختر الإعلانات والإجراء." },
  "Photo not found.": { fr: "Photo introuvable.", ar: "الصورة غير موجودة." },
  "A listing needs at least one photo.": { fr: "Une annonce doit avoir au moins une photo.", ar: "يجب أن يحتوي الإعلان على صورة واحدة على الأقل." },
  "Choose a vehicle and a date.": { fr: "Choisissez un véhicule et une date.", ar: "اختر المركبة والتاريخ." },
  "Enter a brand name.": { fr: "Indiquez le nom de la marque.", ar: "أدخل اسم العلامة." },
  "This brand already exists in this zone.": { fr: "Cette marque existe déjà dans cette rubrique.", ar: "هذه العلامة موجودة مسبقًا في هذا القسم." },
  "Invalid brand order.": { fr: "Ordre des marques non valide.", ar: "ترتيب العلامات غير صالح." },
  "Brand not found.": { fr: "Marque introuvable.", ar: "العلامة غير موجودة." },
  "Choose an image.": { fr: "Choisissez une image.", ar: "اختر صورة." },
  "Unknown setting.": { fr: "Paramètre inconnu.", ar: "إعداد غير معروف." },
  "Settings saved.": { fr: "Paramètres enregistrés.", ar: "تم حفظ الإعدادات." },
  "Enter a name.": { fr: "Indiquez un nom.", ar: "أدخل اسمًا." },
  "Account not found.": { fr: "Compte introuvable.", ar: "الحساب غير موجود." },
  "Keep at least one active owner.": { fr: "Gardez au moins un propriétaire actif.", ar: "يجب الإبقاء على مالك نشط واحد على الأقل." },
  "You cannot delete your own account.": { fr: "Vous ne pouvez pas supprimer votre propre compte.", ar: "لا يمكنك حذف حسابك الخاص." },
  "Enter your email and password.": { fr: "Saisissez votre e-mail et votre mot de passe.", ar: "أدخل بريدك الإلكتروني وكلمة المرور." },
  "The new password is too long.": { fr: "Le nouveau mot de passe est trop long.", ar: "كلمة المرور الجديدة طويلة جدًا." },
  "The password must not contain your email address.": { fr: "Le mot de passe ne doit pas contenir votre adresse e-mail.", ar: "يجب ألا تحتوي كلمة المرور على بريدك الإلكتروني." },
  "Choose a password different from the current one.": { fr: "Choisissez un mot de passe différent de l'actuel.", ar: "اختر كلمة مرور مختلفة عن الحالية." },
  "Listing deleted.": { fr: "Annonce supprimée.", ar: "تم حذف الإعلان." },
};

const LABELS = {
  "Body type": { fr: "Carrosserie", ar: "نوع الهيكل" },
  Mileage: { fr: "Kilométrage", ar: "المسافة المقطوعة" },
  Fuel: { fr: "Carburant", ar: "الوقود" },
  Gearbox: { fr: "Boîte de vitesses", ar: "ناقل الحركة" },
  Seats: { fr: "Places", ar: "عدد المقاعد" },
  "Bike type": { fr: "Type de vélo", ar: "نوع الدراجة" },
  "Motorcycle type": { fr: "Type de moto", ar: "نوع الدراجة النارية" },
  "Vehicle type": { fr: "Type de véhicule", ar: "نوع المركبة" },
  "Electric assist": { fr: "Assistance électrique", ar: "مساعدة كهربائية" },
  "Frame size": { fr: "Taille du cadre", ar: "مقاس الهيكل" },
  "Frame material": { fr: "Matériau du cadre", ar: "مادة الهيكل" },
  "Wheel size": { fr: "Taille des roues", ar: "مقاس العجلات" },
  Gears: { fr: "Vitesses", ar: "عدد السرعات" },
  "Engine size": { fr: "Cylindrée", ar: "سعة المحرك" },
  Payload: { fr: "Charge utile", ar: "الحمولة" },
  "Gross vehicle weight": { fr: "Poids total autorisé", ar: "الوزن الإجمالي المسموح" },
  "Engine power": { fr: "Puissance", ar: "قوة المحرك" },
  "Minimum price": { fr: "Prix minimum", ar: "أدنى سعر" },
  "Maximum price": { fr: "Prix maximum", ar: "أقصى سعر" },
  "Listing id": { fr: "Identifiant d'annonce", ar: "معرّف الإعلان" },
  "Page size": { fr: "Taille de page", ar: "حجم الصفحة" },
  Page: { fr: "Page", ar: "الصفحة" },
};

const LABELS_BY_LOWER = new Map(Object.entries(LABELS).map(([label, names]) => [label.toLowerCase(), names]));

const INSPECTION_STATUSES = {
  pending: { fr: "Reçue", ar: "مستلم" },
  scheduled: { fr: "Planifiée", ar: "مُبرمج" },
  confirmed: { fr: "Confirmée", ar: "مؤكَّد" },
  completed: { fr: "Terminée", ar: "مكتمل" },
  cancelled: { fr: "Annulée", ar: "ملغى" },
};

const REVIEWED = {
  approved: { fr: "L'annonce {id} a été validée.", ar: "تمت الموافقة على الإعلان رقم {id}." },
  rejected: { fr: "L'annonce {id} a été refusée.", ar: "تم رفض الإعلان رقم {id}." },
  sold: { fr: "L'annonce {id} a été marquée comme vendue.", ar: "تم تسجيل الإعلان رقم {id} كمُباع." },
};

const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);

const labelIn = (language, label) => LABELS_BY_LOWER.get(label.toLowerCase())?.[language] ?? label;

const PATTERNS = [
  {
    match: /^(.+) is required\.$/,
    fr: "Le champ « {label} » est obligatoire.",
    ar: "حقل «{label}» مطلوب.",
  },
  {
    match: /^(.+) must be a whole number between (-?\d+) and (-?\d+)\.$/,
    fr: "La valeur de « {label} » doit être un nombre entier compris entre {min} et {max}.",
    ar: "يجب أن تكون قيمة «{label}» عددًا صحيحًا بين {min} و{max}.",
  },
  {
    match: /^(.+) must be a whole number\.$/,
    fr: "La valeur de « {label} » doit être un nombre entier.",
    ar: "يجب أن تكون قيمة «{label}» عددًا صحيحًا.",
  },
  {
    match: /^(.+) must be yes or no\.$/,
    fr: "Répondez par oui ou non pour « {label} ».",
    ar: "اختر نعم أو لا في خانة «{label}».",
  },
  {
    match: /^(.+) must be true or false\.$/,
    fr: "La valeur de « {label} » doit être true ou false.",
    ar: "يجب أن تكون قيمة «{label}» إما true أو false.",
  },
  {
    match: /^Choose a valid (.+)\.$/,
    fr: "Choisissez une option valide pour « {label} ».",
    ar: "اختر قيمة صالحة في خانة «{label}».",
  },
];

const translateDynamic = (message, language) => {
  for (const pattern of PATTERNS) {
    const found = message.match(pattern.match);

    if (found) {
      const [, label, min, max] = found;

      return fill(pattern[language], { label: labelIn(language, label), min, max });
    }
  }

  const statusChange = message.match(/^Cannot change status from (\w+) to (\w+)\.$/);

  if (statusChange) {
    const [, from, to] = statusChange;
    const template = {
      fr: "Impossible de passer du statut « {from} » au statut « {to} ».",
      ar: "لا يمكن تغيير الحالة من «{from}» إلى «{to}».",
    }[language];

    return fill(template, {
      from: INSPECTION_STATUSES[from]?.[language] ?? from,
      to: INSPECTION_STATUSES[to]?.[language] ?? to,
    });
  }

  const maxImages = message.match(/^You can upload a maximum of (\d+) images\.$/);

  if (maxImages) {
    return fill({ fr: "Vous pouvez envoyer {n} images au maximum.", ar: "يمكنك رفع {n} صور كحدّ أقصى." }[language], { n: maxImages[1] });
  }

  const clash = message.match(/^This vehicle already has an inspection at (\d{2}:\d{2}) that day \(request #(\d+)\)\.$/);

  if (clash) {
    return fill(
      {
        fr: "Ce véhicule a déjà une inspection à {time} ce jour-là (demande n° {id}).",
        ar: "لهذه المركبة فحص آخر في الساعة {time} في اليوم نفسه (الطلب رقم {id}).",
      }[language],
      { time: clash[1], id: clash[2] }
    );
  }

  const reviewed = message.match(/^Car (\d+) has been (\w+)\.$/);

  if (reviewed && REVIEWED[reviewed[2]]) {
    return fill(REVIEWED[reviewed[2]][language], { id: reviewed[1] });
  }

  return message;
};

const pickLanguage = (header) => {
  const code = String(header || "").trim().slice(0, 2).toLowerCase();

  return LANGUAGES.includes(code) ? code : "en";
};

const translateMessage = (message, language) => {
  if (language === "en" || typeof message !== "string") {
    return message;
  }

  return MESSAGES[message]?.[language] ?? translateDynamic(message, language);
};

const translateResponses = (req, res, next) => {
  const language = pickLanguage(req.headers["accept-language"]);
  const json = res.json.bind(res);

  res.vary("Accept-Language");
  res.json = (body) =>
    json(
      body && typeof body === "object" && !Array.isArray(body) && typeof body.message === "string"
        ? { ...body, message: translateMessage(body.message, language) }
        : body
    );

  next();
};

module.exports = { pickLanguage, translateMessage, translateResponses };
