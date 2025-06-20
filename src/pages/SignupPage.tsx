import React from 'react';
import Layout from '../components/layout/Layout';
import AuthForm from '../components/auth/AuthForm';

const SignupPage: React.FC = () => {
  return (
    <Layout>
      <div className="min-h-[calc(100vh-160px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <AuthForm isLogin={false} />
      </div>
    </Layout>
  );
};

export default SignupPage;