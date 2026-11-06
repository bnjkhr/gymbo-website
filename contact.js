// Setzt die E-Mail-Adresse erst im Browser zusammen (Spam-Schutz).
// Ohne JavaScript bleibt der lesbare Ersatz „name [at] domain [punkt] tld“ stehen.
document.querySelectorAll('[data-mail-user][data-mail-domain]').forEach(function (el) {
    var address = el.dataset.mailUser + String.fromCharCode(64) + el.dataset.mailDomain;
    var link = document.createElement('a');
    link.href = 'mailto:' + address;
    link.textContent = address;
    el.replaceChildren(link);
});
