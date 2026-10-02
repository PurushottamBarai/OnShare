export const SEO_CONFIG = {
  baseUrl: 'https://onshare.me',
  defaultOgImage: 'https://onshare.me/og-image.png',
  routes: {
    '/': {
      title: 'OnShare – Direct P2P Browser File & Live Text Sharing',
      description: 'Transfer files of any size and share live text directly between browsers using encrypted WebRTC. Fast, private, zero-install, and no cloud storage.',
      canonical: 'https://onshare.me/'
    },
    '/send': {
      title: 'Send Files Online – Secure P2P Browser Transfer | OnShare',
      description: 'Send files and folders directly from your browser to recipient devices with zero upload to cloud servers. Fast peer-to-peer file transfer.',
      canonical: 'https://onshare.me/send'
    },
    '/receive': {
      title: 'Receive Files – Direct Browser-to-Browser Transfer | OnShare',
      description: 'Generate a secure single-use 6-digit code to receive files or live text directly into your browser with end-to-end encryption.',
      canonical: 'https://onshare.me/receive'
    },
    '/text': {
      title: 'Live Text Sharing – Real-Time Collaborative Notepad | OnShare',
      description: 'Collaboratively type, paste, and edit plain text in real-time between browsers without login or storage. Powered by Yjs CRDTs.',
      canonical: 'https://onshare.me/text'
    },
    '/how-it-works': {
      title: 'How It Works – Private P2P WebRTC Transfer | OnShare',
      description: 'Discover how OnShare enables direct browser-to-browser file transfers and live text synchronization with zero content saved on servers.',
      canonical: 'https://onshare.me/how-it-works'
    },
    '/privacy': {
      title: 'Privacy Policy – Zero Content Retention Architecture | OnShare',
      description: 'OnShare never inspects, retains, or stores your file names, contents, or text messages. Review our privacy-by-design policy.',
      canonical: 'https://onshare.me/privacy'
    },
    '/terms': {
      title: 'Terms of Use | OnShare',
      description: 'Read the terms of use for OnShare. Simple guidelines for secure, responsible peer-to-peer browser sharing.',
      canonical: 'https://onshare.me/terms'
    },
    '/contact': {
      title: 'Contact Us – Support & Inquiries | OnShare',
      description: 'Contact the OnShare team for technical support, inquiries, feedback, or abuse reports.',
      canonical: 'https://onshare.me/contact'
    },
    '/feedback': {
      title: 'Feedback & Feature Requests | OnShare',
      description: 'Help improve OnShare by sharing your user experience, bug reports, and feature suggestions.',
      canonical: 'https://onshare.me/feedback'
    }
  }
};

export function getRouteSEO(pathname = '/') {
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  return SEO_CONFIG.routes[cleanPath] || SEO_CONFIG.routes['/'];
}
