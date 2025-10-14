// /api/admin/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, getCompanyFilter, getCompanyIdForCreate, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile, deleteFile, renameFile } from '@/lib/storage';
import path from 'path';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

// GET /api/admin/products - Listar produtos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.company_id) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      where: getCompanyFilter(session),
      include: {
        category: true,
        variants: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error('Products GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar produtos' },
      { status: 500 }
    );
  }
}

// POST /api/admin/products - Criar produto
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.company_id) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;
    const category_id = formData.get('category_id') as string;
    const sku = formData.get('sku') as string | null;
    const base_price = parseFloat(formData.get('base_price') as string);
    const active = formData.get('active') === 'true';
    const imageFile = formData.get('image') as File | null;
    const variantsJson = formData.get('variants') as string | null;

    // Upload da imagem se fornecida
    let image_url = null;
    if (imageFile) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      await sharp(buffer).metadata(); // valida imagem
      const ext = path.extname(imageFile.name) || '.jpg';
      const tempKey = `products/temp/${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
      await uploadFile(buffer, tempKey);
      image_url = tempKey; // será movido ao final
    }

    // Criar produto
    const product = await prisma.product.create({
      data: {
        company_id: session.user.company_id!,
        category_id,
        name,
        description,
        sku,
        base_price,
        image_url,
        active,
      },
    });

    // Mover imagem temporária para pasta final
    if (image_url && image_url.startsWith('products/temp/')) {
      const ext = path.extname(image_url);
      const finalKey = `products/${product.id}/image${ext}`;
      await renameFile(image_url, finalKey);
      await prisma.product.update({
        where: { id: product.id },
        data: { image_url: finalKey },
      });
    }

    // Criar variações se fornecidas
    if (variantsJson) {
      const variants = JSON.parse(variantsJson);
      if (Array.isArray(variants) && variants.length > 0) {
        const variantData = await Promise.all(
          variants.map(async (v: any) => {
            let imageUrl = v.image_url || null;
            if (imageUrl && imageUrl.startsWith('products/temp/')) {
              const ext = path.extname(imageUrl) || '.jpg';
              const finalKey = `products/${product.id}/variants/${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
              await renameFile(imageUrl, finalKey);
              imageUrl = finalKey;
            }
            return {
              product_id: product.id,
              name: v.name,
              volume: v.volume || null,
              unit_type: v.unit_type || null,
              price_modifier: v.price_modifier || 0,
              stock_quantity: v.stock_quantity || 0,
              image_url: imageUrl,
              active: v.active !== false,
            };
          })
        );

        await prisma.productVariant.createMany({
          data: variantData,
        });
      }
    }

    // Buscar produto completo com variações
    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category: true,
        variants: true,
      },
    });

    return NextResponse.json({ success: true, data: fullProduct });
  } catch (error) {
    console.error('Products POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao criar produto' },
      { status: 500 }
    );
  }
}