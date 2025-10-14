import { PrismaClient, UserRole, PaymentMethod, DeliveryType, OrderStatus, EntryType, EntryStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Criar usuário master (ADMINISTRADOR principal - não pode ser excluído)
  // IMPORTANTE: ADMINISTRADOR não está associado a nenhuma distribuidora (company_id = null)
  const masterPassword = await bcrypt.hash('ad98721', 10);
  const masterUser = await prisma.user.upsert({
    where: { email: 'rodrigoalmeidabeo@hotmail.com' },
    update: {},
    create: {
      email: 'rodrigoalmeidabeo@hotmail.com',
      password: masterPassword,
      first_name: 'Rodrigo',
      last_name: 'Almeida',
      phone: '(11) 99999-9999',
      role: UserRole.ADMINISTRADOR,
      active: true,
      is_primary_admin: true, // Não pode ser excluído
      company_id: null, // ADMINISTRADOR não está associado a nenhuma empresa
    },
  });

  console.log('✅ Master user created:', masterUser.email);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
