import { motion, AnimatePresence } from "framer-motion";
import {
  getFadeSlideUpVariants,
  getScrollRevealVariants,
} from "@/hooks/useAnimationUtils";

        <motion.section
          variants={getScrollRevealVariants()}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-120px" }}
          id="hardware"
          className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/90 p-6 shadow-xl backdrop-blur-xl dark:bg-slate-950/65 sm:p-8 overflow-hidden"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <motion.div
                variants={getFadeSlideUpVariants()}
                className="relative rounded-2xl overflow-hidden"
              >
                <motion.img
                  src="/hardware/hardware_1.png"
                  alt="HydroSentinal hardware"
                  className="w-full h-auto rounded-2xl object-cover shadow-2xl transition-transform duration-500 hover:scale-105"
                  initial={{ scale: 0.98, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8 }}
                />
                <motion.div
                  aria-hidden
                  className="absolute inset-0 rounded-2xl ring-1 ring-cyan-200/20 dark:ring-cyan-500/20 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.2, delay: 0.2 }}
                />
              </motion.div>

              <motion.div
                variants={getFadeSlideUpVariants()}
                className="space-y-4"
                id="Hardware"
              >
                <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                  Hardware Architecture
                </h2>
                <p className="text-base leading-7 text-slate-600 dark:text-slate-300">
                  <strong>HydroSentinal Smart Monitoring Hardware</strong>
                  <br />
                  The HydroSentinal hardware unit combines an ESP32
                  microcontroller, pH sensor module, and TDS sensor module to
                  continuously monitor water quality in real time. The system
                  collects sensor readings, processes the data locally, and
                  synchronizes it with the cloud dashboard for analysis, alerts,
                  and intelligent monitoring.
                </p>

                <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300 list-inside list-disc pl-4">
                  <li>ESP32 Development Board</li>
                  <li>pH Module</li>
                  <li>TDS Module</li>
                  <li>Cloud Connectivity</li>
                  <li>Real-Time Monitoring</li>
                  <li>Intelligent Alert System</li>
                </ul>

                <div className="h-2" />
              </motion.div>
            </div>
          </div>
        </motion.section>