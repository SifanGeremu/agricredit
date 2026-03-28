/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
  Leaf, 
  Users, 
  ShieldCheck, 
  TrendingUp, 
  UserPlus, 
  FileText, 
  Truck, 
  Sprout,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';

// --- Components ---

const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-emerald-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Leaf className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-emerald-900 tracking-tight">AgriCredit</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#problem" className="text-emerald-800 hover:text-emerald-600 font-medium transition-colors">Problem</a>
            <a href="#solution" className="text-emerald-800 hover:text-emerald-600 font-medium transition-colors">Solution</a>
            <a href="#how-it-works" className="text-emerald-800 hover:text-emerald-600 font-medium transition-colors">How it Works</a>
            <a href="#features" className="text-emerald-800 hover:text-emerald-600 font-medium transition-colors">Features</a>
            <Link to="/login" className="bg-emerald-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-emerald-700 transition-all shadow-sm">
              Login
            </Link>
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-emerald-900">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white border-b border-emerald-100 px-4 pt-2 pb-6 space-y-4"
        >
          <a href="#problem" className="block text-emerald-800 font-medium" onClick={() => setIsOpen(false)}>Problem</a>
          <a href="#solution" className="block text-emerald-800 font-medium" onClick={() => setIsOpen(false)}>Solution</a>
          <a href="#how-it-works" className="block text-emerald-800 font-medium" onClick={() => setIsOpen(false)}>How it Works</a>
          <a href="#features" className="block text-emerald-800 font-medium" onClick={() => setIsOpen(false)}>Features</a>
          <Link to="/login" className="block w-full bg-emerald-600 text-white px-5 py-3 rounded-xl font-semibold text-center">
            Login
          </Link>
        </motion.div>
      )}
    </nav>
  );
};

const Hero = () => (
  <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 text-center lg:text-left"
        >
          <span className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold tracking-wide text-emerald-700 uppercase bg-emerald-50 rounded-full">
            Revolutionizing Rural Finance
          </span>
          <h1 className="text-5xl lg:text-7xl font-extrabold text-emerald-950 leading-[1.1] mb-6">
            Empowering Farmers with <span className="text-emerald-600">Smart Agricultural Credit</span>
          </h1>
          <p className="text-xl text-emerald-800/80 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
            Access loans without collateral using group trust and direct vendor payments. We bridge the gap between smallholder farmers and financial growth.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <Link to="/register" className="w-full sm:w-auto bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 group">
              Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/login" className="w-full sm:w-auto bg-white text-emerald-900 border-2 border-emerald-100 px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-50 transition-all text-center">
              Login
            </Link>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="flex-1 relative"
        >
          <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border-8 border-white">
            <img 
              src="https://picsum.photos/seed/farm-hero/800/600" 
              alt="Farmers in the field" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-100 rounded-full blur-3xl -z-10 opacity-60"></div>
          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-emerald-200 rounded-full blur-3xl -z-10 opacity-40"></div>
        </motion.div>
      </div>
    </div>
  </section>
);

const Problem = () => (
  <section id="problem" className="py-24 bg-emerald-50/50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 order-2 lg:order-1">
          <img 
            src="https://picsum.photos/seed/bank-problem/600/400" 
            alt="Financial struggle" 
            className="rounded-2xl shadow-xl"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex-1 order-1 lg:order-2">
          <h2 className="text-3xl lg:text-4xl font-bold text-emerald-950 mb-8">The Barriers to Growth</h2>
          <div className="space-y-6">
            {[
              { icon: <AlertCircle className="text-red-500" />, title: "Lack of Access", desc: "Smallholder farmers are often excluded from traditional banking systems." },
              { icon: <ShieldCheck className="text-red-500" />, title: "Collateral Requirements", desc: "Banks demand assets that most rural farmers simply don't have." },
              { icon: <TrendingUp className="text-red-500" />, title: "Fund Misuse", desc: "Cash loans are frequently diverted to non-agricultural needs, leading to debt cycles." }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4 p-6 bg-white rounded-2xl shadow-sm border border-emerald-100"
              >
                <div className="mt-1">{item.icon}</div>
                <div>
                  <h3 className="text-xl font-bold text-emerald-900 mb-1">{item.title}</h3>
                  <p className="text-emerald-800/70">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Solution = () => (
  <section id="solution" className="py-24">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1">
          <h2 className="text-3xl lg:text-4xl font-bold text-emerald-950 mb-6">AgriCredit: The Smart Way to Farm</h2>
          <p className="text-lg text-emerald-800/80 mb-8 leading-relaxed">
            We've reimagined agricultural finance by focusing on community and direct impact. No more cash-in-hand risks or impossible collateral demands.
          </p>
          <ul className="space-y-4 mb-10">
            {[
              "Group-based lending using social collateral",
              "Direct vendor payments to ensure input quality",
              "Dynamic credit scoring based on farming performance"
            ].map((text, i) => (
              <li key={i} className="flex items-center gap-3 text-emerald-900 font-medium">
                <CheckCircle2 className="text-emerald-600 w-6 h-6 flex-shrink-0" />
                {text}
              </li>
            ))}
          </ul>
          <img 
            src="https://picsum.photos/seed/farm-market/500/300" 
            alt="Farmer and vendor" 
            className="rounded-2xl shadow-lg border-4 border-emerald-50"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex-1 bg-emerald-900 rounded-[2.5rem] p-8 lg:p-12 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-6">Why it works?</h3>
            <p className="text-emerald-100/80 mb-8">
              By paying vendors directly for seeds, fertilizers, and tools, we ensure that 100% of the loan value goes into the soil. This boosts yields and guarantees repayment capacity.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
                <div className="text-3xl font-bold text-emerald-400 mb-1">98%</div>
                <div className="text-sm text-emerald-200">Repayment Rate</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
                <div className="text-3xl font-bold text-emerald-400 mb-1">40%</div>
                <div className="text-sm text-emerald-200">Yield Increase</div>
              </div>
            </div>
          </div>
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-800 rounded-full opacity-50"></div>
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-800 rounded-full opacity-50"></div>
        </div>
      </div>
    </div>
  </section>
);

const HowItWorks = () => (
  <section id="how-it-works" className="py-24 bg-emerald-50/50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h2 className="text-3xl lg:text-4xl font-bold text-emerald-950 mb-16">Your Journey to Success</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { icon: <UserPlus className="w-8 h-8" />, title: "Register", desc: "Sign up and join a local trusted farmer group.", img: "farmer" },
          { icon: <FileText className="w-8 h-8" />, title: "Request Loan", desc: "Select the inputs you need from our verified vendors.", img: "money" },
          { icon: <Truck className="w-8 h-8" />, title: "Get Inputs", desc: "Vendors deliver seeds and tools directly to you.", img: "seed" },
          { icon: <Sprout className="w-8 h-8" />, title: "Repay", desc: "Sell your harvest and repay easily through the app.", img: "harvest" }
        ].map((step, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative"
          >
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-emerald-100 h-full flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                {step.icon}
              </div>
              <img 
                src={`https://picsum.photos/seed/${step.img}/150/150`} 
                alt={step.title} 
                className="w-24 h-24 rounded-full mb-6 object-cover border-4 border-emerald-50"
                referrerPolicy="no-referrer"
              />
              <h3 className="text-xl font-bold text-emerald-900 mb-3">{i + 1}. {step.title}</h3>
              <p className="text-emerald-800/70">{step.desc}</p>
            </div>
            {i < 3 && (
              <div className="hidden lg:block absolute top-1/2 -right-4 translate-x-1/2 -translate-y-1/2 z-10">
                <ArrowRight className="text-emerald-200 w-8 h-8" />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const Features = () => (
  <section id="features" className="py-24">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-3xl lg:text-4xl font-bold text-emerald-950 mb-4">Powerful Features for Farmers</h2>
        <p className="text-emerald-800/70 max-w-2xl mx-auto">Everything you need to manage your agricultural business and financial growth in one place.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { icon: <Users />, title: "Group Lending", desc: "Leverage collective trust for better loan terms.", img: "team" },
          { icon: <ShieldCheck />, title: "Secure Tracking", desc: "Real-time monitoring of your loan and input delivery.", img: "security" },
          { icon: <TrendingUp />, title: "Vendor Integration", desc: "Access a network of verified high-quality vendors.", img: "market" },
          { icon: <TrendingUp />, title: "Credit Growth", desc: "Build your score and unlock larger loans over time.", img: "graph" }
        ].map((feature, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -10 }}
            className="bg-white p-8 rounded-3xl shadow-xl shadow-emerald-900/5 border border-emerald-50 text-center"
          >
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
              {feature.icon}
            </div>
            <h3 className="text-xl font-bold text-emerald-900 mb-3">{feature.title}</h3>
            <p className="text-emerald-800/70 mb-6">{feature.desc}</p>
            <img 
              src={`https://picsum.photos/seed/${feature.img}/100/100`} 
              alt={feature.title} 
              className="w-20 h-20 rounded-2xl mx-auto object-cover grayscale hover:grayscale-0 transition-all"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const CTA = () => (
  <section className="py-24 bg-emerald-600 relative overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="bg-emerald-900/30 backdrop-blur-md rounded-[3rem] p-12 lg:p-20 flex flex-col lg:flex-row items-center justify-between gap-12 border border-white/10">
        <div className="text-center lg:text-left">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">Start your farming journey with financial support today</h2>
          <p className="text-emerald-100 text-xl mb-10 max-w-xl">Join thousands of farmers who are growing their yields and their futures with AgriCredit.</p>
          <Link to="/register" className="inline-block bg-white text-emerald-900 px-10 py-4 rounded-full font-bold text-xl hover:bg-emerald-50 transition-all shadow-xl">
            Register Now
          </Link>
        </div>
        <div className="relative">
          <img 
            src="https://picsum.photos/seed/happy-farmer/400/300" 
            alt="Happy farmer" 
            className="rounded-3xl shadow-2xl border-4 border-white/20"
            referrerPolicy="no-referrer"
          />
          <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
              <Sprout />
            </div>
            <div>
              <div className="text-xs text-emerald-800/60 font-bold uppercase">Status</div>
              <div className="text-emerald-900 font-bold">Loan Approved</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/20 skew-x-12 translate-x-1/4"></div>
  </section>
);

const Footer = () => (
  <footer className="py-12 bg-emerald-950 text-emerald-200">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-emerald-900 pb-12 mb-12">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Leaf className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">AgriCredit</span>
        </div>
        <div className="flex gap-8 text-sm font-medium">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Contact Us</a>
        </div>
      </div>
      <div className="text-center text-sm text-emerald-400">
        <p>© {new Date().getFullYear()} AgriCredit. Built for the Agriculture Innovation Hackathon.</p>
        <p className="mt-2 italic">Empowering the roots of our food system.</p>
      </div>
    </div>
  </footer>
);

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
