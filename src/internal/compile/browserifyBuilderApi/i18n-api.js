var _ = require('lodash');

module.exports = {
	getPrefLanguage: function() {
		var availables = this.config().locales;

		var chooseLang = [
			navigator.language,
			navigator.browserLanguage,
			navigator.systemLanguage,
			navigator.userLanguage
		];
		if (navigator.languages  && navigator.languages.length > 0) {
			chooseLang.unshift(navigator.languages[0]);
		}

		if (navigator.languages && navigator.languages.length > 1) {
			chooseLang = chooseLang.concat(navigator.languages.slice(1));
		}
		var pref;
		if (!_.some(chooseLang, function(language) {
			if (language && _.includes(availables, language)) {
				pref = language;
				return true;
			}
			return false;
		})) {
			_.some(chooseLang, function(language) {
				var forbackLang = /[a-zA-Z]*/.exec(language);
				forbackLang = forbackLang ? forbackLang[0] : false;
				if (forbackLang && _.includes(availables, forbackLang)) {
					pref = forbackLang;
					return true;
				}
			});
		}
		pref = pref ? pref : this.config.get('locales[0]', 'zh');
		return pref;
	},

	getLocaleUrl: function(lang) {
		lang = _.trim(lang, '/');
		var url;
		if (lang === this.config.get('locales[0]', 'zh'))
			url = this.config().staticAssetsURL + location.pathname;
		else
			url = this.config().staticAssetsURL + '/' + lang + location.pathname;
		return url;
	},

	reloadToLocale: function(lang) {
		if (!this.isInDefaultLocale())
			return false;
		lang = _.trim(lang, '/');
		if (this.buildLocale !== lang) {
			window.location = this.getLocaleUrl(lang);
			return true;
		}
		return false;
	},

	isInDefaultLocale: function() {
		return this.buildLocale === this.config.get('locales[0]', 'zh');
	}
};
